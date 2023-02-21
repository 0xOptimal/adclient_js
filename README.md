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
chain = "tezos"; // 

const viewer = { "wallets": [chain = "tezos" + ":" + wallet_address1,
 chain + ":" + wallet_address2] 
 };

window.optimal_run(viewer)
```

This will automatically fetch a relevant ad (if any available) and display it by filling in each provided `<div>` element.

## Tracking of impressions and viewing time

Once the ads have been loaded, the script adds event triggers via `setInterval()` and the `visibilitychange` event in order to measure which ads were actually viewed (i.e. in viewport at some point) and how long for each of them.

This data is then relayed to the backend server automatically.

## Advanced usage

>See an example of advanced usage in the `test.html` file.

You can directly call `get_optimal_ad(placement, callback)` and pass a Placement object and a `callback(err, data)` function. The callback will receive the error if any and the data as a JSON object if not. 

You can create the Placement object from an element that will display the ad, e.g.

```html
<div optimal-publisher="test-publisher" optimal-type="image-banner" id="ad"></div>
```

Or manually:
```javascript
 new Placement(
    publisher, // your-publisher-slug
    ad_type, // "text", "image", etc. In practice there can be many specific types of ads that may have been especially designed for your app, including type of media and size. Speak to us about this
    target, // which HTML element will contain the ad
    options // see below
    viewer_data, // data about the viewer. Currently a structure with a single property: {"wallets":[wallet_address1, wallet_address2, ...]}
 )

 let options = {
    keywords = [], // keywords associated with your page/app
    load_manually = true, 
    force_ad = ""; // slug of the specific ad that you know you want in this location, in the style of publisher1-campaign1-ad1
    campaign_types = ["paid", "publisher-house", "community", "house"] // ads from which types of campaigns fit in here
    force_campaign = "", // if you know for a fact you only want to display, e.g. "house" ads or "paid" ads
 }
```

`get_optimal_ad()` returns a JSON object like so:

```javascript
 ad_data = {
    "id": "test-campaign-nft-test-ad-1", // slug that uniquely identifies the ad
    "text": "<a href=\"https://i.useoptimal.xyz/proxy/click/4/d89c2dd2-377b-4b85-8a41-b6e544e3212d/\" rel=\"nofollow noopener\" target=\"_blank\"><strong>NyanPig NFT </strong><span>gm gm 💎🙌</span><strong> come get your 🌈🐷</strong></a>", // HTML rendered text
    "body": "NyanPig NFT gm gm 💎🙌 come get your 🌈🐷", // the full body text
    "copy": // the body text in fragments
    {
        "headline": "NyanPig NFT",
        "cta": "come get your 🌈🐷",
        "content": "gm gm 💎🙌"
    },
    "image": "https://i.useoptimal.xyz/media/images/2023/01/nft_porky.gif", // the image url
    "link": "https://i.useoptimal.xyz/proxy/click/4/d89c2dd2-377b-4b85-8a41-b6e544e3212d/",
    "view_url": "https://i.useoptimal.xyz/proxy/view/4/d89c2dd2-377b-4b85-8a41-b6e544e3212d/",
    "view_time_url": "https://i.useoptimal.xyz/proxy/viewtime/4/d89c2dd2-377b-4b85-8a41-b6e544e3212d/",
    "nonce": "d89c2dd2-377b-4b85-8a41-b6e544e3212d",
    "display_type": "image-banner",
    "campaign_type": "paid",
    "div_id": "ad"
 }
```

When `render_html=true`, the data object will also contain a `html` property that will contain fully rendered HTML for the ad, based on the template defined as part of the ad_type on the server.
