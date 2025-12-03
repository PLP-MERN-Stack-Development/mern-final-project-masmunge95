/**
 * OCR Receipt Parser
 * Parses receipt and invoice OCR results
 * Extracted from ocrController.js for better testability
 */

const { getCenterX, getMidY, isNumerical, isBarcode } = require('../../../utils/ocrHelpers');
const { IGNORE_KEYWORDS, ADDRESS_NOISE } = require('../constants/ocrConstants');

/**
 * Parse receipt/invoice OCR results
 * @param {Array} results - OCR analysis results from Azure/Google Vision
 * @returns {Object} Extracted receipt data
 */
const parseOcrResult = (results) => {
    const PROXIMITY_RANGE = 250; 
    
    const extractedData = {
        businessName: '', // Will be dynamically assigned
        businessAddress: '',
        invoiceNo: '', // FINAL FIELD NAME
        invoiceDate: '',
        deliveryDetails: {},
        items: [],
        fees: [], 
        subtotal: 0.00,
        tax: 0.00,
        total: 0.00,
        paymentMethod: '',
        promotions: '',
    };

    if (!results || results.length === 0 || !Array.isArray(results)) {
        return extractedData;
    }

    const allLines = Array.isArray(results) && results.length > 0 
        ? results.flatMap(page => page.lines || [])
        : [];
    const sortedLines = allLines.map(line => ({
        text: line.text,
        midY: getMidY(line.boundingBox),
        centerX: getCenterX(line.boundingBox),
        boundingBox: line.boundingBox,
        isUsed: false,
        isIgnore: IGNORE_KEYWORDS.some(k => line.text.includes(k)) || line.text.length < 3 
    })).sort((a, b) => a.midY - b.midY);

    const COLUMNS = {
        DESCRIPTION_MAX_X: 1450, 
        PRICE_MIN_X: 1450
    };

    // --- 1. Header and Address Extraction ---
    let headerStart = 0;
    
    // Dynamically find the first significant line as the business name
    const nameLine = sortedLines.find(l => !l.isIgnore && l.text.length > 5);
    if (nameLine) {
        let businessName = nameLine.text;
        // Clean up leading conjunctions like "In" from the business name
        const conjunctionRegex = /^(In|At|On|For|The|A|An)\s/i;
        businessName = businessName.replace(conjunctionRegex, '');

        extractedData.businessName = businessName;
        nameLine.isUsed = true;
        headerStart = sortedLines.indexOf(nameLine) + 1;
    }
    
    // Extract Invoice No/Date
    const topLines = sortedLines.slice(0, 60);
    for (const line of topLines) {
        
        // Invoice No. extraction: Find label, then find value to its right
        const invoiceRegex = /\b(Invoice No|Invoice Number)\b/i;
        if (invoiceRegex.test(line.text)) {
            const labelLine = line;
            const sameLineMatch = labelLine.text.match(/(\d{7,})/);
            if (sameLineMatch) {
                extractedData.invoiceNo = sameLineMatch[0];
                labelLine.isUsed = true;
            } else {
                const valueLine = sortedLines.find(l =>
                    !l.isUsed && isNumerical(l.text) && l.text.length >= 7 &&
                    Math.abs(l.midY - labelLine.midY) < 50 && // Allow for slight vertical deviation
                    l.centerX > labelLine.centerX // Must be to the right
                );
                if (valueLine) {
                    extractedData.invoiceNo = valueLine.text;
                    valueLine.isUsed = true;
                    labelLine.isUsed = true;
                }
            }
        }
        
        if (line.text.includes('Invoice Date')) {
            const dateLine = sortedLines.find(l => 
                l.text.match(/(\d{1,2}-\w{3}-\d{4})/) && l.midY > line.midY - 20 && l.midY < line.midY + PROXIMITY_RANGE
            );
            if (dateLine) {
                extractedData.invoiceDate = dateLine.text.match(/(\d{1,2}-\w{3}-\d{4})/)?.[0] || '';
                dateLine.isUsed = true;
            }
        }
    }

    // Extract Order # / Invoice No / Transaction # from receipt header
    const orderLine = sortedLines.find(l => /\b(order\s?#?|invoice\s?#?|transaction\s?#?)\s*:?\s*\d+/i.test(l.text));
    if (orderLine && !extractedData.invoiceNo) {
        const match = orderLine.text.match(/\b(?:order|invoice|transaction)\s?#?\s*:?\s*(\d+)/i);
        if (match) {
            extractedData.invoiceNo = match[1];
            orderLine.isUsed = true;
        }
    }
    
    // Extract Invoice/Receipt Date from header
    // Support multiple date formats: DD/MM/YYYY, DD-MMM-YYYY, YYYY-MM-DD, etc.
    for (let i = 0; i < Math.min(sortedLines.length, 20); i++) {
        const line = sortedLines[i];
        if (line.isUsed) continue;
        
        // Check for date labels followed by date value (same line or next line)
        if (/\b(date|invoice\s?date|receipt\s?date|transaction\s?date)\b/i.test(line.text)) {
            // Try extracting date from same line first
            let dateMatch = line.text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/); // DD/MM/YYYY or DD-MM-YYYY
            if (!dateMatch) {
                dateMatch = line.text.match(/(\d{1,2}\s?-?\s?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s?-?\s?\d{2,4})/i); // DD-MMM-YYYY
            }
            if (!dateMatch) {
                dateMatch = line.text.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/); // YYYY-MM-DD
            }
            
            if (dateMatch) {
                extractedData.invoiceDate = dateMatch[1].trim();
                line.isUsed = true;
                break;
            }
            
            // If not on same line, check next line
            if (i + 1 < sortedLines.length) {
                const nextLine = sortedLines[i + 1];
                if (!nextLine.isUsed) {
                    dateMatch = nextLine.text.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})$/);
                    if (!dateMatch) {
                        dateMatch = nextLine.text.match(/^(\d{1,2}\s?-?\s?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s?-?\s?\d{2,4})$/i);
                    }
                    if (dateMatch) {
                        extractedData.invoiceDate = dateMatch[1].trim();
                        nextLine.isUsed = true;
                        line.isUsed = true;
                        break;
                    }
                }
            }
        }
    }

    // Address extraction - stop at first item-like line or total
    let businessAddressLines = [];
    const headerEndIndex = sortedLines.findIndex(l => l.text.includes('Delivery Note'));
    const headerEnd = headerEndIndex !== -1 ? headerEndIndex : sortedLines.length;
    
    for(let i = headerStart; i < headerEnd && i < headerStart + 6; i++){ // Limit to ~6 lines
        const line = sortedLines[i];
        
        const isNoise = ADDRESS_NOISE.some(n => line.text.includes(n));
        // Stop if we hit item-like patterns (qty + description) or metadata keywords
        const looksLikeItem = /^\d{1,2}\s+[A-Za-z]/i.test(line.text);
        const looksLikeMetadata = /\b(total|tax|sub\s?total|order|transaction|receipt|invoice|table|guests|dine|server|station|cashier|register|date|time)\b/i.test(line.text);

        if (looksLikeItem || looksLikeMetadata) {
            break; // Stop address extraction here
        }

        if (!line.isUsed && !line.isIgnore && !isNoise && line.text.length > 5) { 
             businessAddressLines.push(line.text);
             line.isUsed = true;
        }
    }
    extractedData.businessAddress = businessAddressLines.join(', ');


    // --- 2. Item and Fee Extraction ---
    for (let i = 0; i < sortedLines.length; i++) {
        const currentLine = sortedLines[i];
        
        // Final check to filter out known noisy lines
        if (currentLine.isUsed || currentLine.isIgnore) continue;

        const lineText = currentLine.text;

        // A. General Document/Footer Details
        if (lineText.includes('Apartment:') || lineText.includes('Building:') || lineText.includes('Delivery Area:')) {
            extractedData.deliveryDetails[lineText.split(':')[0].trim()] = lineText.split(':')[1]?.trim() || lineText;
            currentLine.isUsed = true;
            continue;
        }

        const paymentRegex = /\b(Payment|Paid By|Method)\b/i;
        if (paymentRegex.test(lineText) && lineText.length < 15) { // Avoid matching long sentences
            const labelLine = currentLine;
            
            // Search horizontally first, then vertically as a fallback
            let valueLine = sortedLines.find(l =>
                !l.isUsed && !isNumerical(l.text) && l.text.length > 3 &&
                Math.abs(l.midY - labelLine.midY) < 50 && // Vertically close
                l.centerX > labelLine.centerX // To the right
            );
            
            // Fallback: check the line immediately below if nothing is found to the right
            if (!valueLine) {
                const nextLine = sortedLines[i + 1];
                if (nextLine && !nextLine.isUsed && !isNumerical(nextLine.text) && nextLine.text.length > 3) {
                    if (Math.abs(nextLine.midY - labelLine.midY) < 50) {
                        valueLine = nextLine;
                    }
                }
            }
            
            if (valueLine) {
                extractedData.paymentMethod = valueLine.text;
                valueLine.isUsed = true;
                labelLine.isUsed = true;
                continue;
            }
        }

        const promoRegex = /\b(PROMO|Discount)\b/i;
        if (promoRegex.test(lineText)) {
            const promoMatch = lineText.match(/\((.+)\)/);
            if(promoMatch) extractedData.promotions = promoMatch[1];
            
            // Now, find the associated discount value
            const valueLine = sortedLines.find(l =>
                !l.isUsed && l.text.match(/^\d+\.\d{2}$/) && // Looks like currency
                Math.abs(l.midY - currentLine.midY) < 50 && // Allow for slight vertical deviation
                l.centerX > currentLine.centerX // To the right
            );
            if (valueLine) {
                const discountAmount = parseFloat(valueLine.text);
                if (discountAmount > 0) {
                    extractedData.fees.push({ description: `Discount (${promoMatch ? promoMatch[1] : ''})`, amount: -discountAmount, isDelivery: false });
                    valueLine.isUsed = true;
                }
            }
            currentLine.isUsed = true;
            continue;
        }

        // B. Fee Isolation (More Robust)
        const feeRegex = /\b(Delivery|Service|Charge|Fee)\b/i;
        if (feeRegex.test(lineText)) {
            let fee = { description: lineText, amount: 0.00, isDelivery: /\bDelivery\b/i.test(lineText) };
            let feeFound = false;

            // Case 1: Fee and amount are on the same line
            const sameLineMatch = lineText.match(/([\d\.]+)$/);
            if (sameLineMatch) {
                fee.amount = parseFloat(sameLineMatch[1]);
                feeFound = true;
            } else {
                // Case 2: Amount is on a subsequent line in the price column
                const nextLine = sortedLines.slice(i + 1, i + 4).find(l =>
                    l.centerX >= COLUMNS.PRICE_MIN_X && isNumerical(l.text)
                );
                if (nextLine) {
                    fee.amount = parseFloat(nextLine.text);
                    nextLine.isUsed = true;
                    feeFound = true;
                }
            }

            // Case 3: The fee is explicitly marked as "Free"
            if (lineText.toLowerCase().includes('free')) {
                fee.amount = 0.00;
                feeFound = true;
            }

            if (feeFound) {
                extractedData.fees.push(fee);
                currentLine.isUsed = true;
                continue;
            }
        }
    }

    // --- Item Extraction (Barcode-First Approach) ---
    const barcodeLines = sortedLines.filter(l => isBarcode(l.text) && !l.isUsed);

    for (const barcodeLine of barcodeLines) {
        let item = { sku: barcodeLine.text, description: '', quantity: 0, unitPrice: 0.00, totalPrice: 0.00 };
        let descriptionFound = false;
        let pricingFound = false;

        // --- Step 1: Find the Description Line (usually right below the barcode) ---
        const descriptionLine = sortedLines.find(l =>
            !isNumerical(l.text) &&
            l.centerX < COLUMNS.DESCRIPTION_MAX_X &&
            l.midY > barcodeLine.midY && l.midY < barcodeLine.midY + 100 // Relaxed vertical search
        );

        if (descriptionLine) {
            item.description = descriptionLine.text;
            descriptionFound = true;
            descriptionLine.isUsed = true; // Mark as used
        }

        // --- Step 2: Find the Pricing Line (Qty x Price) ---
        // Search in the vertical vicinity of the description or barcode line
        const searchMidY = descriptionFound ? descriptionLine.midY : barcodeLine.midY;
        const pricingLine = sortedLines.find(l =>
            !l.isUsed && // Ensure the line hasn't been consumed
            l.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/) &&
            l.centerX >= COLUMNS.PRICE_MIN_X &&
            Math.abs(l.midY - searchMidY) < 100
        );

        if (pricingLine) {
            const qtyPriceMatch = pricingLine.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/);
            if (qtyPriceMatch) {
                item.quantity = parseFloat(qtyPriceMatch[1]);
                item.unitPrice = parseFloat(qtyPriceMatch[3]);
                pricingFound = true;
                pricingLine.isUsed = true; // Mark as used
            }
        }

        // --- Step 3: Find the Total Price Line ---
        const totalLine = sortedLines.find(l =>
            !l.isUsed && // Ensure the line hasn't been consumed
            isNumerical(l.text) &&
            l.centerX >= COLUMNS.PRICE_MIN_X &&
            Math.abs(l.midY - searchMidY) < 100 &&
            (!pricingLine || Math.abs(l.midY - pricingLine.midY) > 5) // Ensure it's not the same line as pricing
        );

        if (totalLine) {
            item.totalPrice = parseFloat(totalLine.text);
            totalLine.isUsed = true; // Mark as used
        }

        // --- Final Item Validation and Addition ---
        if (descriptionFound && pricingFound) {
            // If total is missing, calculate it
            if (item.totalPrice === 0 && item.quantity > 0 && item.unitPrice > 0) {
                item.totalPrice = parseFloat((item.quantity * item.unitPrice).toFixed(2));
            }
            
            // Add the item if it's valid
            extractedData.items.push(item);
            barcodeLine.isUsed = true; // Mark the anchor barcode as used
        }
    }

    // --- Fallback Item Extraction (Description-First) ---
    // This loop catches items that don't have a barcode.
    for (const line of sortedLines) {
        if (line.isUsed || isNumerical(line.text) || line.centerX > COLUMNS.DESCRIPTION_MAX_X) {
            continue;
        }

        // Potential description found
        let item = { sku: '', description: line.text, quantity: 0, unitPrice: 0.00, totalPrice: 0.00 };
        let pricingFound = false;

        const pricingLine = sortedLines.find(l =>
            !l.isUsed &&
            l.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/) &&
            l.centerX >= COLUMNS.PRICE_MIN_X &&
            Math.abs(l.midY - line.midY) < 100 // Relaxed vertical search to match barcode logic
        );

        if (pricingLine) {
            const qtyPriceMatch = pricingLine.text.match(/(\d+(\.\d+)?)\s*[xX×]\s*([\d\.]+)/);
            if (qtyPriceMatch) {
                item.quantity = parseFloat(qtyPriceMatch[1]);
                item.unitPrice = parseFloat(qtyPriceMatch[3]);
                pricingFound = true;
            }
        }

        if (pricingFound) {
            line.isUsed = true;
            pricingLine.isUsed = true;
            item.totalPrice = parseFloat((item.quantity * item.unitPrice).toFixed(2));
            
            // Only if we found a qty/price line, we can also look for an explicit total to be more accurate.
            const totalLine = sortedLines.find(l => !l.isUsed && isNumerical(l.text) && l.centerX >= COLUMNS.PRICE_MIN_X && Math.abs(l.midY - line.midY) < 50);
            if (totalLine) {
                item.totalPrice = parseFloat(totalLine.text);
            }

            extractedData.items.push(item);
        }
    }

    // --- Post-Processing: Re-classify items that are actually fees ---
    const feeRegex = /\b(Delivery|Service|Charge|Fee)\b/i;
    const itemsToKeep = [];
    for (const item of extractedData.items) {
        if (feeRegex.test(item.description)) {
            extractedData.fees.push({
                description: item.description,
                amount: item.totalPrice,
                isDelivery: /\bDelivery\b/i.test(item.description)
            });
        } else {
            itemsToKeep.push(item);
        }
    }
    extractedData.items = itemsToKeep;

    // --- Extract Tax Amount ---
    // Look for lines containing tax keywords followed by a number
    const taxKeywords = /\b(tax|vat|gst|sales tax|tax total|total tax)\b/i;
    for (let i = 0; i < sortedLines.length; i++) {
        const line = sortedLines[i];
        if (line.isUsed) continue;
        if (taxKeywords.test(line.text)) {
            // Try to extract number from same line (e.g., "Tax: 4.60" or "Tax 1: 4.60")
            let match = line.text.match(/[\d,]+\.?\d{1,2}/);
            let taxValue = match ? parseFloat(match[0].replace(/,/g, '')) : null;
            
            // If no valid number on same line, check next line
            if (!taxValue || taxValue < 0.01) {
                if (i + 1 < sortedLines.length) {
                    const nextLine = sortedLines[i + 1];
                    if (!nextLine.isUsed) {
                        const nextMatch = nextLine.text.match(/^[\$£€]?([\d,]+\.?\d{1,2})$/);
                        if (nextMatch) {
                            taxValue = parseFloat(nextMatch[1].replace(/,/g, ''));
                            nextLine.isUsed = true;
                        }
                    }
                }
            }
            
            if (taxValue && !isNaN(taxValue) && taxValue > 0 && taxValue < 10000) {
                extractedData.tax = taxValue;
                line.isUsed = true;
                break; // Use first tax found
            }
        }
    }

    // --- Extract Subtotal and Total ---
    const subtotalKeywords = /\b(sub\s?total|subtotal|sub-total)\b/i;
    const totalKeywords = /\b(total|grand\s?total|amount\s?due)\b/i;
    
    for (let i = 0; i < sortedLines.length; i++) {
        const line = sortedLines[i];
        if (line.isUsed) continue;
        const lowerText = line.text.toLowerCase();
        
        // Extract subtotal
        if (subtotalKeywords.test(lowerText) && extractedData.subtotal === 0) {
            let match = line.text.match(/[\d,]+\.?\d{1,2}/);
            let value = match ? parseFloat(match[0].replace(/,/g, '')) : null;
            
            // If no number on same line, check next line
            if (!value && i + 1 < sortedLines.length) {
                const nextLine = sortedLines[i + 1];
                if (!nextLine.isUsed) {
                    const nextMatch = nextLine.text.match(/^[\$£€]?([\d,]+\.?\d{1,2})$/);
                    if (nextMatch) {
                        value = parseFloat(nextMatch[1].replace(/,/g, ''));
                        nextLine.isUsed = true;
                    }
                }
            }
            
            if (value && !isNaN(value) && value > 0 && value < 1000000) {
                extractedData.subtotal = value;
                line.isUsed = true;
            }
        }
        
        // Extract total (but not subtotal)
        if (totalKeywords.test(lowerText) && !subtotalKeywords.test(lowerText) && extractedData.total === 0) {
            let match = line.text.match(/[\$£€]?[\d,]+\.?\d{1,2}/);
            let value = match ? parseFloat(match[0].replace(/[$£€,]/g, '')) : null;
            
            // If no number on same line, check next line
            if (!value && i + 1 < sortedLines.length) {
                const nextLine = sortedLines[i + 1];
                if (!nextLine.isUsed) {
                    const nextMatch = nextLine.text.match(/^[\$£€]?([\d,]+\.?\d{1,2})$/);
                    if (nextMatch) {
                        value = parseFloat(nextMatch[1].replace(/[$£€,]/g, ''));
                        nextLine.isUsed = true;
                    }
                }
            }
            
            if (value && !isNaN(value) && value > 0 && value < 1000000) {
                extractedData.total = value;
                line.isUsed = true;
            }
        }
    }

    // --- Fallback: Simple line-item extraction for receipts without complex layouts ---
    // If we didn't find items using spatial parsing, try pattern-based extraction
    if (extractedData.items.length === 0) {
        const skipKeywords = /\b(total|tax|sub|payment|thank|street|avenue|road|hwy|blvd|cashier|server|station|register|transaction|receipt|invoice|change|tendered|loyalty|account|balance|hscodes|qt|price|item)\b/i;
        
        for (let i = 0; i < sortedLines.length; i++) {
            const line = sortedLines[i];
            if (line.isUsed || line.isIgnore) continue;
            if (skipKeywords.test(line.text)) continue;
            
            // Pattern 1: "quantity description [price]"
            const simpleItemMatch = line.text.match(/^(\d+)\s+([A-Za-z][A-Za-z\s\-'\/]+)(?:\s+([\d,]+\.?\d{1,2}))?$/);
            if (simpleItemMatch) {
                const qty = parseInt(simpleItemMatch[1]) || 1;
                const desc = simpleItemMatch[2].trim();
                let amt = simpleItemMatch[3] ? parseFloat(simpleItemMatch[3].replace(/,/g, '')) : null;
                
                // If no amount on same line, look for price on next lines (columnar layout)
                if (!amt && i + 1 < sortedLines.length) {
                    for (let j = i + 1; j <= Math.min(i + 5, sortedLines.length - 1); j++) {
                        const nextLine = sortedLines[j];
                        if (nextLine.isUsed || skipKeywords.test(nextLine.text)) continue;
                        const priceMatch = nextLine.text.match(/^[\$£€]?([\d,]+\.?\d{1,2})$/);
                        if (priceMatch) {
                            const candidatePrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                            if (candidatePrice > 0 && candidatePrice < 100000) {
                                amt = candidatePrice;
                                nextLine.isUsed = true;
                                break;
                            }
                        }
                    }
                }
                
                if (amt && amt > 0 && desc.length > 2) {
                    extractedData.items.push({
                        description: desc,
                        quantity: qty,
                        unitPrice: parseFloat((amt / qty).toFixed(2)),
                        totalPrice: amt,
                        amount: amt,
                        sku: ''
                    });
                    line.isUsed = true;
                }
                continue;
            }
            
            // Pattern 2: Description-only lines (columnar receipts like DICII)
            // Match all-caps product names (e.g., "VELVEX LEMON D/W")
            if (/^[A-Z][A-Z\s\/\-']{3,}$/i.test(line.text) && line.text.length > 5 && line.text.length < 40) {
                const desc = line.text.trim();
                let qty = 1;
                let amt = null;
                
                // Look ahead for quantity (single digit) and prices
                for (let j = i + 1; j <= Math.min(i + 5, sortedLines.length - 1); j++) {
                    const nextLine = sortedLines[j];
                    if (nextLine.isUsed || skipKeywords.test(nextLine.text)) continue;
                    
                    // Check for standalone quantity
                    if (/^\d{1}$/.test(nextLine.text)) {
                        qty = parseInt(nextLine.text, 10);
                        nextLine.isUsed = true;
                    }
                    
                    // Check for price
                    const priceMatch = nextLine.text.match(/^[\$£€]?([\d,]+\.?\d{1,2})$/);
                    if (priceMatch && !amt) {
                        const candidatePrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                        if (candidatePrice > 0 && candidatePrice < 100000) {
                            amt = candidatePrice;
                            nextLine.isUsed = true;
                        }
                    }
                }
                
                if (amt && amt > 0) {
                    extractedData.items.push({
                        description: desc,
                        quantity: qty,
                        unitPrice: parseFloat((amt / qty).toFixed(2)),
                        totalPrice: amt,
                        amount: amt,
                        sku: ''
                    });
                    line.isUsed = true;
                }
            }
        }
    }

    // --- Final Pass: Recalculate item totals for consistency ---
    extractedData.items.forEach(item => {
        if (item.quantity > 0 && item.unitPrice > 0) {
            item.totalPrice = parseFloat((item.quantity * item.unitPrice).toFixed(2));
        }
    });

    // --- Final total and subtotal calculation ---
    const finalItemSubtotal = extractedData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const feeTotal = extractedData.fees.reduce((sum, fee) => sum + fee.amount, 0);
    extractedData.subtotal = parseFloat(finalItemSubtotal.toFixed(2));
    extractedData.total = parseFloat((finalItemSubtotal + feeTotal + extractedData.tax).toFixed(2));
    
    return extractedData;
};

module.exports = { parseOcrResult };
