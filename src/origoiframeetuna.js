import Origo from 'Origo';
import { boundingExtent, getCenter } from 'ol/extent';

const { GeoJSON } = Origo.ol.format;

/**
 * @param {{ layerIDField: string, maxZoom: number, zoomDuration: number, homeWhenZero: boolean, baseUrl: string }} options
 */
const Origoiframeetuna = function Origoiframeetuna(options = {}) {
  const {
    layerIDField, maxZoom, zoomDuration, allowedOrigins, homeWhenZero = false, baseUrl
  } = options;

  let viewer;
  let startExtent;

  /** @type string|undefined */
  let cqlFilter;

  /**
   * HTTP POST for WMS getMap via custom image/tileLoadFunction to avoid too long cql filter urls
   */
  async function imageLoadFunction(loadedImage, src) {
    const url = new URL(src.split('?')[0]);
    let objectUrl;
    const img = loadedImage.getImage();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
    };

    const WMSOptions = {
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded'
      },
      body: src.split('?')[1]
    };
    const response = await fetch(url, WMSOptions);
    if (response.ok) {
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
    }
  }
  /**
   * If source url does not appear absolute then use the baseUrl param if available
   * else try to ascertain the current location origin/domain
  */
  function getAbsoluteSourceURL(src) {
    let urlString = src.getUrl === 'function' ? src.getUrl() : src.getUrls()[0];

    if (!urlString.startsWith('http')) {
      if (baseUrl) urlString = baseUrl.concat(urlString);
      else urlString = window.location.origin.concat(urlString);
    }
    return urlString;
  }

  /**
   * Apply the current filter (from `cqlFilter`) to the layer
   */
  function applyFiltering(targetLayer) {
    const layer = viewer.getLayer(targetLayer);
    if (layer.get('type') === 'WMS') {
      const WMSSource = layer.getSource();
      WMSSource.setUrl(getAbsoluteSourceURL(WMSSource));

      if (WMSSource.imageLoadFunction) WMSSource.setImageLoadFunction(imageLoadFunction);
      else if (WMSSource.tileLoadFunction) WMSSource.setTileLoadFunction(imageLoadFunction);
      layer.getSource().updateParams({ CQL_FILTER: cqlFilter });
    } else {
      console.warn('Layer of type', layer.get('type'), 'is not supported for iframe filtering');
    }
  }

  /**
   * Format ids with single quotation marks
   *
   * @param {String[]} ids
   * @returns {String[]}
   */
  function getFilterIds(ids) {
    if (ids.length === 0) return "''";
    const newArray = ids.map((id) => `'${id}'`);
    return newArray.join();
  }

  /**
   * Retrieve matching features from a WFS service
   *
   * @param {URL} url
   * @param {String[]} ids
   * @returns {Promise<import("ol/Feature").default[]>}
   */
  async function getFeaturesFromWFS(targetLayer, url, ids) {
    const body = new URLSearchParams();
    body.set('service', 'WFS');
    body.set('version', '1.1.1');
    body.set('request', 'GetFeature');
    body.set('outputFormat', 'application/json');
    body.set('typeNames', targetLayer);
    body.set('cql_filter', `${layerIDField} in (${getFilterIds(ids)})`);

    const WFSOptions = {
      method: 'POST',
      body
    };

    const result = await fetch(url.toString(), WFSOptions);
    const JSONresult = await result.json();
    return new GeoJSON().readFeatures(JSONresult);
  }

  /**
   * Retrieve features that match the specified ids
   * @param {String[]} ids
   * @returns {Promise<import("ol/Feature").default[]>}
   */
  function getFeatures(targetLayer, ids) {
    const layer = viewer.getLayer(targetLayer);
    if (layer.get('type') === 'WMS') {
      // this works for geoserver, but might not for others
      const source = layer.getSource();
      const urlString = getAbsoluteSourceURL(source);
      const url = new URL(urlString);
      url.pathname = url.pathname.replace('wms', 'wfs');
      return getFeaturesFromWFS(targetLayer, url, ids);
    }
    /*  experimental
    if (layer.get('type') === 'WFS') {
      // warning: code path not tested
      // best case - we already have the feature
      // may be relevant pending further evalution
      const feature = layer
        .getSource()
        .getFeatures()
        .find(f => f.get(layerIDField) === id);
      if (feature) {
        return Promise.resolve(feature);
      }
      // otherwise, we need to fetch it
      return getFeatureFromWFS(new URL(layer.getSource().getUrl()), id);
    } */
    throw new Error(
      `Layer of type ${layer.get('type')} is not supported for iframe feature pan/zoom`
    );
  }

  async function getExtent(ids, targetLayer) {
    if (ids.length === 0) {
      if (!homeWhenZero) return null;
      return startExtent;
    }

    const featureArray = await getFeatures(targetLayer, ids);
    const coordinateArray = featureArray.map((feature) => feature.getGeometry().getFirstCoordinate());
    const extent = boundingExtent(coordinateArray);

    return extent;
  }

  return Origo.ui.Component({
    name: 'origoiframeetuna',
    onInit() {
      window.addEventListener('message', (event) => {
        if (allowedOrigins) {
          if (!allowedOrigins.some((origin) => origin === event.origin)) return;
        }

        const {
          command, targetLayer, ids, filter
        } = event.data;
        if (!command || !targetLayer) {
          console.warn(
            'An object with a command, targetLayer as well as either ids or filter property is required.'
          );
          return;
        }
        if (command === 'setFilter' && !filter) {
          console.warn('An object with the setFilter command needs a filter property too.');
          return;
        }
        if (command !== 'setFilter' && command !== 'resetFilter' && !ids) {
          console.warn(
            'An object with a panToo, zoomTo or setVisibleIDs command needs an ids property too.'
          );
          return;
        }

        if (command === 'setFilter') {
          // command to set a raw CQL query
          cqlFilter = filter;
          applyFiltering(targetLayer);
        } else if (command === 'setVisibleIDs') {
          // command to filter by the ID field
          cqlFilter = `${layerIDField} in (${getFilterIds(ids)})`;
          applyFiltering(targetLayer);
        } else if (command === 'resetFilter') {
          // command to reset the filter, showing all features
          cqlFilter = undefined;
          applyFiltering(targetLayer);
        } else if (command === 'panTo') {
          // command to pan to an array of features. If they do not fit inside the view then they do not fit inside the view.
          getExtent(ids, targetLayer).then((extent) => {
            if (!(extent === null)) {
              viewer
                .getMap()
                .getView()
                .setCenter(getCenter(extent));
            }
          });
        } else if (command === 'zoomTo') {
          // command to zoom to a an array of features

          getExtent(ids, targetLayer).then((extent) => {
            if (!(extent === null)) {
              viewer
                .getMap()
                .getView()
                .fit(extent, {
                  maxZoom,
                  duration: zoomDuration,
                  padding: [20, 20, 20, 20]
                });
            }
          });
        } else {
          console.warn(
            'Received a message with an invalid command. Expected setFilter|setVisibleIDs|resetFilter|panTo|zoomTo.'
          );
        }
      });
    },
    onAdd(evt) {
      viewer = evt.target;
      const map = viewer.getMap();
      startExtent = map.getView().calculateExtent(map.getSize());

      // in case the layer gets added _after_ we have received a message
      // experimental
    /*  viewer
        .getMap()
        .getLayers()
        .on('add', async ({element}) => {
          if (element.get('name')) {
            applyFiltering();
          }
        }); */
    },
    render() {
      // no-op
    }
  });
};

export default Origoiframeetuna;
