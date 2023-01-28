# Optimal Adclient JS

Optimal AdClient JS is a javascript client library for displaying ads via the Optimal ad network on any website.

It allows you to easily integrate your website or web application with Optimal's ad network and display ads on any site that allows connecting a non-custodial crypto wallet.

## Installation

To integrate Optimal Client JS, simply include the library in your project by adding the following tags to the head of your HTML file:

```html
<script src="https://optimalcdn.s3.amazonaws.com/optimal.js"></script>

<link href="https://optimalcdn.s3.amazonaws.com/optimal.css" rel="stylesheet">
```

This repo is publicly provided for reference, but we do not encourage local integrations as the code is guaranteed to change frequently.

## Usage

Once the library is loaded, all you need is one or more `<div>` elements as the placeholders where the ads can be displayed that contain one of several attributes that will identify it as an Optimal placeholder.

```html
<div optimal-publisher="test-publisher" optimal-type="image-banner" id="ad"></div>
```

Some attribute parameters you can specify here are:
- optimal-publisher: the slug identifier of your site or app, as registered in the Optimal Ads Manager
- optimal-type: the type of ad that could feature here. There are several options in the works and we can work together on defining a type that works best for your site ore app


Call the `window.optimal_run()` method once your page has finished loading and your user has connected (to) their wallet(s).

```javascript
chain_id = "tezos"; // Also

const viewer = { "wallets": [chain_id + ":" + wallet_address1,
 chain_id + ":" + wallet_address2] 
 };

window.optimal_run(viewer)
```

This will automatically fetch a relevant ad (if any available) and display it by filling in each provided `<div>` element.

## Tracking of impressions and viewing time

Once the ads have been loaded, the script adds event triggers via `setInterval()` and the `visibilitychange` event in order to measure which ads were actually viewed (i.e. in viewport at some point) and how long for each of them.

This data is then relayed to the backend server automatically.