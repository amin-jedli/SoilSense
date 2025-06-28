// predictionWorker.js
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.9.0/dist/tf.min.js');

self.onmessage = async (e) => {
  const { input, modelJson } = e.data;

  // Reconstruct the model
  const model = await tf.models.modelFromJSON(modelJson);

  // Prepare input tensor
  const inputTensor = tf.tensor3d([input]);

  // Make prediction
  const prediction = model.predict(inputTensor);
  const moisturePred = prediction.dataSync()[0];
  const moisture = moisturePred * 100;

  // Calculate confidence (simplified)
  const confidence = Math.min(0.95, 1 - Math.abs(moisturePred - input[input.length - 1][0])).toFixed(2);

  // Calculate feature importance (simplified using input contributions)
  const featureImportance = {
    moisture: Math.abs(input[input.length - 1][0]),
    rainfall: Math.abs(input[input.length - 1][6])
  };

  self.postMessage({
    predictions: [{ moisture, confidence }],
    featureImportance
  });
};