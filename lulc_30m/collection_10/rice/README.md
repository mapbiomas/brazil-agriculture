<div>
    <img src='../../../assets/new_logo.png' height='auto' width='200' align='right'>
    <h1>Rice (Irrigated)</h1>
</div>

Developed by ***Remap Geotecnologia Ltda***.

## About

This folder contains the scripts to classify and post-process the **irrigated rice** subclass.

We recommend that you read the [Agriculture Appendix of the Algorithm Theoretical Basis Document (ATBD)](https://mapbiomas.org/download-dos-atbds), since important informations about the classification methodology can be found in there.

## How to use

### Classification

#### Classification using UNET 

1. Open [this notebook](./01a_unet_training_pipeline.ipynb) and follow the training steps to train the model on your data;

2. Open [this notebook](./02a_unet_inference_pipeline.ipynb) and follow the inference steps.

#### Classification using Random Forest

1. Open the script **agriculture/rice/02b_classification_rf.js**;

2. On **line 66** (variable `outputCollection`), set the path to save the ImageCollection raw classification result;

3. On **line 74** (variable `selected_UFs`), set the UF for each Brazilian state you want to classify (considering the options available on `settings_uf`);

4. Run the script.

### Post-processing

To run the post-processing, follow these steps:

1. Open the script **agriculture/rice/03_temporal_filter.js**;

2. On **line 34** (variable `filters`), set the path to the [temporal_spatial_filters.js](../../../utils/temporal_spatial_filters.js) script you copied to your GEE account;

3. On **line 42** (variable `input`), set the path to the ImageCollection raw classification result;

4. On **line 45** (variable `output`), set the path to the filtered result;

5. Run the script.
