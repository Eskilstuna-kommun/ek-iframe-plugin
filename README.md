# origo-iframe-etuna

Provides a way of controlling certain aspects of an Origo instance within an `<iframe>` via https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage

### Configuration options

- `layerIDField`: The unique id column / primary key of the layer. **Obligatory**.
- `maxZoom`: Max zoom level. **Optional**.
- `zoomDuration`: Time in milliseconds to complete a zoom transition. **Optional**.
- `allowedOrigins`: An array of strings of accepted origins. **Optional**.
- `homeWhenZero`: A boolean to control whether the map should pan or zoom to its start position when a message with the commands 'zoomTo' or 'panTo' are received together with an empty 'ids' array. Default is `false`.
- `baseUrl` : A string representing the map server protocol and domain. Can be used if map layers are specified with a relative url like 'geoserver/workspace/ows'. **Optional**.

### Messages

Messages sent via postMessage to an Origo instance with this plugin are normal js objects with the following properties:
- `command`
- `targetLayer`
as well as either
- `filter`
or
- `ids`

`command` is one of the following:

- `setFilter` set a CQL filter.
- `setVisibleIDs` filter so that only features with a `layerIDField` value matches one of the values of `ids`.
- `resetFilter` reset the filter and shows all features.
- `zoomTo` zoom to the center of those features with a `layerIDField` property matching a value of `ids`.
- `panTo` pan to the center of those features with a `layerIDField` property matching a value of `ids`.

Example message object:
```javascript
const zoomToMessage = {
	command: 'zoomTo',
	targetLayer: 'sokvyxw_utegym',
	ids: ['uuid4', 'uuid5', 'uuid9']
}
```

### Example config:

```html
<script type="text/javascript">
    const origo = Origo('index.json');
    origo.on('load', function (viewer) {
      const origoiframeetuna = Origoiframeetuna({
          layerIDField: "globalId",
          maxZoom: 11,
          zoomDuration: 750,
          allowedOrigins: ["http://localhost:9001", "https://www.somedomain.net"],
          baseUrl: "https://megamegamapserver.certainly.net"
      });
      viewer.addComponent(origoiframeetuna);
    });
</script>
```

### Dev

1. Clone Origo and this repo
2. Run `npm install` and then `npm start` in both local clones
4. Open `http://localhost:9001/demo/` in a web browser

(if CORS-errors something of the following may be needed in Origo's tasks/webpack.dev.js:
```javascript
  devServer: {
    static: {
      directory: './'
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    },
```
)
