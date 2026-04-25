require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const ImageAnalysisService = require('./services/imageAnalysisService');

async function testRoboflow() {
  console.log('Testing Roboflow Workflow 8 integration...');
  
  const testImagePath = path.join(__dirname, 'test-pothole.jpg');
  
  try {
    console.log('Downloading test image...');
    const response = await axios({
      url: 'https://raw.githubusercontent.com/ultralytics/yolov5/master/data/images/zidane.jpg',
      method: 'GET',
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(testImagePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    console.log('Test image downloaded. Initializing ImageAnalysisService...');
    
    const service = new ImageAnalysisService();
    console.log('Running analysis...');
    const result = await service.validateAndAnalyzeImage(testImagePath);
    
    console.log('--- Roboflow Validation Result ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('-----------------------------------');
    
    if (result && result.allowUpload) {
      console.log('✅ TEST PASSED: Roboflow successfully validated the image.');
    } else {
      console.log('⚠️ TEST COMPLETED: Roboflow returned valid response, but marked image as invalid (or confidence was low).');
    }
  } catch (error) {
    console.error('❌ TEST FAILED: Error occurred during validation');
    console.error(error);
  } finally {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  }
}

testRoboflow();
