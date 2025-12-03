require("dotenv").config();
const { ComputerVisionClient } = require("@azure/cognitiveservices-computervision");
const { ApiKeyCredentials } = require("@azure/ms-rest-js");
const { AzureKeyCredential } = require("@azure/core-auth");
const { DocumentAnalysisClient } = require("@azure/ai-form-recognizer");

const computerVisionClient = () => {
  const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT;
  const key = process.env.AZURE_COMPUTER_VISION_KEY;

  if (!endpoint || !key) {
    throw new Error("Azure Computer Vision credentials not found in .env file.");
  }

  const credentials = new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } });
  return new ComputerVisionClient(credentials, endpoint);
};


const documentIntelligenceClient = () => {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint || !key) {
    throw new Error("Azure Document Intelligence credentials not found in .env file.");
  }

  return new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
};


const analyzeImage = async (imageSource) => {
  const client = computerVisionClient();
  const result = await client.readInStream(imageSource);
  const operationId = result.operationLocation.split("/").slice(-1)[0];

  let analysisResult = await client.getReadResult(operationId);
  while (analysisResult.status !== "succeeded" && analysisResult.status !== "failed") {
    await new Promise((resolve) => setTimeout(resolve, 500));
    analysisResult = await client.getReadResult(operationId);
  }

  if (analysisResult.status === "failed") {
    throw new Error("Azure Computer Vision analysis failed.");
  }

  return analysisResult.analyzeResult.readResults;
};


const analyzeDocument = async (documentSource, model = "prebuilt-layout") => {
  const client = documentIntelligenceClient();
  const poller = await client.beginAnalyzeDocument(model, documentSource);

  const result = await poller.pollUntilDone();
  
  // Return standardized format based on model type
  if (model === 'prebuilt-layout') {
    // For layout model, return tables and key-value pairs
    return {
      tables: result.tables || [],
      keyValuePairs: result.keyValuePairs || [],
      pages: result.pages || [],
      content: result.content || ''
    };
  } else if (model === 'prebuilt-invoice') {
    return result.documents || [];
  } else {
    // For read model, return raw text
    return result.pages || [];
  }
};

module.exports = {
  analyzeImage,
  analyzeDocument,
};
