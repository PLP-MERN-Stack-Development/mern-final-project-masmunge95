/**
 * OCR Utility Bill Parser
 * Parses water meter and utility bill OCR results
 * Extracted from ocrController.js for better testability
 */

const { getCenterX, getMidY, isNumerical, isBarcode } = require('../../../utils/ocrHelpers');

/**
 * Parse utility bill/water meter OCR results
 * @param {Array} results - OCR analysis results from Azure/Google Vision
 * @returns {Object} Extracted utility data
 */
const parseUtilityBill = (results) => {
    const extractedData = {
        manufacturer: "",
        serialNumber: "",
        standard: "",
        modelSpecs: {
            q3: "",
            q3_q1_ratio: "", 
            pn: "",
            class: "",
            multipliers: [],
            maxTemp: "",
            orientation: ""
        },
        mainReading: ""
    };

    if (!results || results.length === 0) {
        return extractedData;
    }

    // 1. Flatten all lines and pre-process them with spatial data
    const allLines = results.flatMap(page => page.lines)
        .map(line => {
            const normalizedText = line.text.trim();
            return {
                text: normalizedText,
                upperText: normalizedText.toUpperCase(),
                midY: getMidY(line.boundingBox),
                centerX: getCenterX(line.boundingBox),
                boundingBox: line.boundingBox, 
                isUsed: false,
            };
        })
        .filter(line => line.text.length >= 2);

    // --- 2. Extraction Logic ---
    const M3_UNIT_LINE_TEXT = "M3";
    
    // A. Standard (ISO 4064)
    for (const line of allLines) {
        const isoMatch = line.upperText.match(/ISO\s*(\d+)/);
        if (isoMatch) {
            extractedData.standard = `ISO ${isoMatch[1]}`;
            line.isUsed = true;
            break;
        }
    }

    // B. Model Specs (Q3, PN, Class, Multipliers)
    const specKeywordLocations = [];
    for (const line of allLines) {
        if (line.isUsed) continue;

        // Q3 with explicit label
        const q3Match = line.text.match(/Q3[:\s]+(.*)/i);
        if (q3Match) {
            extractedData.modelSpecs.q3 = q3Match[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
            continue; 
        }
        
        // Q3/Qn flow rate from composite lines (e.g., "5 m /h", "Qn-1.5m³/h", "Qn 1,5 B - H", "Q n=1,5 m3 / h")
        // Handle both comma and period as decimal separator, OCR errors like "On" instead of "Qn"
        // Also handle orientation info (B - H for horizontal, A - V for vertical)
        const flowMatch = line.text.match(/(?:Q\s*n|Qn|On)[-:\s=]?(\d+[,\.]?\d*)(?:\s*m[³3]?\s*\/?\s*h)?(?:\s+[AB]?\s*-?\s*[HV])?/i);
        if (flowMatch && !extractedData.modelSpecs.q3 && flowMatch[1]) {
            // Normalize the captured value (replace comma with period)
            const flowValue = flowMatch[1].replace(',', '.');
            extractedData.modelSpecs.q3 = `Qn ${flowValue} m³/h`;
            specKeywordLocations.push({ midY: line.midY });
            
            // Extract orientation if present in same line
            const orientMatch = line.text.match(/([AB])\s*-\s*([HV])/i);
            if (orientMatch && !extractedData.modelSpecs.orientation) {
                const letter = orientMatch[1].toUpperCase();
                const dir = orientMatch[2].toUpperCase();
                extractedData.modelSpecs.orientation = letter === 'A' ? 'A-vertical' : 'B-horizontal';
            }
            // Don't mark as used - still check for temp/pressure
        }

        const q3q1Match = line.upperText.match(/Q3\/Q1\s*=\s*(\d+)/);
        if (q3q1Match) {
            extractedData.modelSpecs.q3_q1_ratio = q3q1Match[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
            continue; 
        }

        const pnMatch = line.text.match(/PN([-:\s]*\d+\s*bar)/i);
        if (pnMatch) {
            extractedData.modelSpecs.pn = pnMatch[1].trim();
            specKeywordLocations.push({ midY: line.midY });
            // Don't mark as used yet - extract other specs from same line
        }
        
        // Extract temperature rating (may include orientation like "90℃ A - V" or ranges like "5-90°C")
        const tempMatch = line.text.match(/(\d+(?:-\d+)?)\s*[℃°C]/i);
        if (tempMatch && !extractedData.modelSpecs.maxTemp) {
            extractedData.modelSpecs.maxTemp = tempMatch[1] + '℃';
            specKeywordLocations.push({ midY: line.midY });
            
            // Extract orientation if present in same line and not already captured
            const orientMatch = line.text.match(/([AB])\s*-\s*([HV])/i);
            if (orientMatch && !extractedData.modelSpecs.orientation) {
                const letter = orientMatch[1].toUpperCase();
                const dir = orientMatch[2].toUpperCase();
                extractedData.modelSpecs.orientation = letter === 'A' ? 'A-vertical' : 'B-horizontal';
            }
        }

        const classMatch = line.upperText.match(/CLASS[:\s]+([A-Z])/);
        if (classMatch) {
            extractedData.modelSpecs.class = classMatch[1];
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
        }

        // Match multipliers with optional space and comma/period (X0.0001, X 0,0001, X 0.0001)
        const multiplierMatch = line.text.match(/X\s*0[,\.]\d+/gi);
        if (multiplierMatch) {
            // Normalize: remove space, replace comma with period
            const normalized = multiplierMatch.map(m => m.replace(/\s/g, '').replace(',', '.'));
            extractedData.modelSpecs.multipliers.push(...normalized);
            specKeywordLocations.push({ midY: line.midY });
            line.isUsed = true;
        }
        
        // Extract installation orientation (handles multiple formats)
        // Formats: "A-vertical", "B-horizontal", "BH/AV", "H-B", "V-A", "B.H", "A.V"
        if (!extractedData.modelSpecs.orientation) {
            const orientationMatch = line.text.match(/(A-vertical|B-horizontal|BH\/AV|AV\/BH|H-B|V-A|B-H|A-V|B\.H|A\.V)/i);
            if (orientationMatch) {
                const matched = orientationMatch[1].toUpperCase().replace(/\./g, '-');
                if (matched.includes('BH') || matched.includes('H-B') || matched.includes('B-H')) {
                    extractedData.modelSpecs.orientation = 'B-horizontal';
                } else if (matched.includes('AV') || matched.includes('V-A') || matched.includes('A-V')) {
                    extractedData.modelSpecs.orientation = 'A-vertical';
                } else {
                    extractedData.modelSpecs.orientation = matched;
                }
                line.isUsed = true;
            }
        }
    }
    
    // C. Manufacturer Detection (handles Latin and Cyrillic)
    const manufacturerCandidates = [];
    const noiseKeywords = ['ISO', 'CLASS', 'PN', 'Q3', ...extractedData.modelSpecs.multipliers];
    for (const line of allLines) {
        // Check for all-caps words (4+ characters) that could be manufacturer names
        // Support both Latin (A-Z) and Cyrillic characters
        const latinMatch = /^[A-Z]{4,}$/.test(line.upperText);
        const cyrillicMatch = /^[\u0400-\u04FF\u0500-\u052F]{4,}/.test(line.text);
        const hasCopyright = line.text.includes('©');
        
        if (line.isUsed || (!latinMatch && !cyrillicMatch && !hasCopyright)) continue;
        if (noiseKeywords.some(noise => line.upperText.includes(noise))) continue;
        
        // Extract manufacturer name (remove © if present)
        const manufacturerName = line.text.replace('©', '').trim();
        if (!manufacturerName || manufacturerName.length < 4) continue;

        let minDistance = Infinity;
        if (specKeywordLocations.length > 0) {
            for (const spec of specKeywordLocations) {
                const distance = Math.abs(line.midY - spec.midY);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            if (minDistance < 200) { 
                manufacturerCandidates.push({ text: manufacturerName, distance: minDistance });
            }
        } else {
            // If no specs found yet, add manufacturer candidates without distance check
            manufacturerCandidates.push({ text: manufacturerName, distance: 0 });
        }
    }

    if (manufacturerCandidates.length > 0) {
        manufacturerCandidates.sort((a, b) => a.distance - b.distance);
        extractedData.manufacturer = manufacturerCandidates[0].text;
        const foundLine = allLines.find(l => l.text === extractedData.manufacturer);
        if (foundLine) foundLine.isUsed = true;
    }

    // D. Serial Number (Distinguish from main reading using multiple heuristics)
    let serialNumber = '';
    let serialLine = null;
    let mainReadingCandidate = null;
    let allNumericLines = [];
    
    for (const line of allLines) {
        if (line.isUsed) continue;
        const cleanedText = line.text.replace(/\s/g, '');
        const hasDecimal = cleanedText.includes('.');
        const numericMatch = cleanedText.match(/\b(\d+\.?\d*)\b/);
        
        if (numericMatch && numericMatch[1].replace('.', '').length >= 5) {
            allNumericLines.push({
                text: line.text,
                cleaned: cleanedText,
                value: numericMatch[1],
                hasDecimal: hasDecimal,
                length: numericMatch[1].replace('.', '').length,
                midY: line.midY,
                line: line
            });
        }
    }
    
    if (allNumericLines.length === 0) {
        extractedData.serialNumber = '';
    } else if (allNumericLines.length === 1) {
        serialNumber = allNumericLines[0].value;
        serialLine = allNumericLines[0].line;
    } else {
        // Multiple candidates - use heuristics to distinguish
        const decimalCandidates = allNumericLines.filter(n => n.hasDecimal);
        const wholeNumberCandidates = allNumericLines.filter(n => !n.hasDecimal);
        
        if (decimalCandidates.length > 0 && wholeNumberCandidates.length > 0) {
            decimalCandidates.sort((a, b) => b.length - a.length);
            serialNumber = decimalCandidates[0].value;
            serialLine = decimalCandidates[0].line;
            
            wholeNumberCandidates.sort((a, b) => b.length - a.length);
            mainReadingCandidate = wholeNumberCandidates[0];
        } else if (decimalCandidates.length > 0) {
            decimalCandidates.sort((a, b) => b.length - a.length);
            serialNumber = decimalCandidates[0].value;
            serialLine = decimalCandidates[0].line;
        } else {
            allNumericLines.sort((a, b) => {
                const aHasDecimal = a.value.includes('.');
                const bHasDecimal = b.value.includes('.');
                if (aHasDecimal !== bHasDecimal) {
                    return aHasDecimal ? 1 : -1;
                }
                return a.midY - b.midY;
            });
            
            serialNumber = allNumericLines[0].value;
            serialLine = allNumericLines[0].line;
            
            if (allNumericLines.length > 1) {
                mainReadingCandidate = allNumericLines[1];
            }
        }
    }
    
    extractedData.serialNumber = serialNumber;
    if (serialLine) {
        serialLine.isUsed = true; 
    }

    // E. Main Reading Extraction
    if (mainReadingCandidate && mainReadingCandidate.value) {
        extractedData.mainReading = mainReadingCandidate.value;
        if (mainReadingCandidate.line) {
            mainReadingCandidate.line.isUsed = true;
        }
    } else {
        // Look for unit marker (m³ or M3)
        let unitLine = allLines.find(line => line.upperText.includes(M3_UNIT_LINE_TEXT));
        
        if (!unitLine) {
            // Look for "m" followed by "3" or "³" on adjacent lines
            for (let i = 0; i < allLines.length - 1; i++) {
                const currentLine = allLines[i];
                const nextLine = allLines[i + 1];
                
                if (currentLine.upperText.trim() === 'M' && (nextLine.text.trim() === '3' || nextLine.text.trim() === '³')) {
                    unitLine = {
                        ...currentLine,
                        text: 'm³',
                        upperText: 'M3',
                        midY: (currentLine.midY + nextLine.midY) / 2,
                        centerX: (currentLine.centerX + nextLine.centerX) / 2
                    };
                    break;
                }
            }
        }

        if (unitLine) {
            const readingCandidates = [];
            const MAX_VERTICAL_SEARCH = 350;
            const MAX_HORIZONTAL_SEARCH = 250;

            for (const line of allLines) {
                if (line.isUsed) continue;

                const cleanedText = line.text.replace(/\s/g, '');
                if (!isNumerical(cleanedText) || isBarcode(cleanedText)) continue;
                
                const horizontalDistance = Math.abs(line.centerX - unitLine.centerX);
                const verticalDistance = Math.abs(line.midY - unitLine.midY);
                
                if (horizontalDistance < MAX_HORIZONTAL_SEARCH && verticalDistance < MAX_VERTICAL_SEARCH) { 
                    const LENGTH_WEIGHT_FACTOR = 50; 
                    const ABOVE_UNIT_BONUS = 20;
                    
                    let score = (cleanedText.length * LENGTH_WEIGHT_FACTOR) - (horizontalDistance + verticalDistance);
                    
                    if (line.midY < unitLine.midY) {
                        score += ABOVE_UNIT_BONUS;
                    }
                    
                    readingCandidates.push({ value: line.text, score: score, length: cleanedText.length, line });
                }
            }

            if (readingCandidates.length > 0) {
                let finalCandidates = readingCandidates.filter(
                    candidate => candidate.value.replace(/\s/g, '') !== extractedData.serialNumber
                );
                
                if (finalCandidates.length === 0) {
                    return extractedData; 
                }

                finalCandidates.sort((a, b) => b.score - a.score);
                
                const bestReading = finalCandidates[0];
                extractedData.mainReading = bestReading.value.replace(/\s/g, ''); 
                bestReading.line.isUsed = true; 
            }
        } else {
            // Fallback: Look for longest prominent number or spaced-out numbers
            const numberCandidates = [];
            for (const line of allLines) {
                if (line.isUsed) continue;
                const cleanedText = line.text.replace(/\s/g, '');
                
                // Check if number ends with M or m³
                const endsWithUnit = /\d+[Mm][³3]?$/i.test(line.text);
                if (endsWithUnit) {
                    const numericPart = cleanedText.replace(/[Mm][³3]?$/i, '');
                    if (numericPart.length >= 6 && numericPart !== extractedData.serialNumber) {
                        numberCandidates.push({ 
                            value: numericPart, 
                            length: numericPart.length, 
                            line,
                            isSpaced: false,
                            priority: 20
                        });
                        continue;
                    }
                }
                
                // Check for spaced numbers (e.g., "0 0 2 0 0 3 4 9")
                const spacedNumberMatch = line.text.match(/^[\d\s]+$/);
                if (spacedNumberMatch && cleanedText.length >= 6) {
                    if (cleanedText !== extractedData.serialNumber && cleanedText !== extractedData.serialNumber.replace('.', '')) {
                        numberCandidates.push({ 
                            value: cleanedText, 
                            length: cleanedText.length, 
                            line,
                            isSpaced: true,
                            priority: 10
                        });
                    }
                } else if (isNumerical(cleanedText) && !isBarcode(cleanedText) && cleanedText.length >= 6) {
                    if (cleanedText !== extractedData.serialNumber && cleanedText !== extractedData.serialNumber.replace('.', '')) {
                        numberCandidates.push({ 
                            value: cleanedText, 
                            length: cleanedText.length, 
                            line,
                            isSpaced: false,
                            priority: 0
                        });
                    }
                }
            }
            
            if (numberCandidates.length > 0) {
                numberCandidates.sort((a, b) => {
                    if (a.priority !== b.priority) return b.priority - a.priority;
                    return b.length - a.length;
                });
                const bestReading = numberCandidates[0];
                extractedData.mainReading = bestReading.value;
                bestReading.line.isUsed = true;
            }
        }
    }
    
    return extractedData;
};

module.exports = { parseUtilityBill };
