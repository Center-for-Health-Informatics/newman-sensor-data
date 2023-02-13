/* global mapboxgl */

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('map')
  const map = new mapboxgl.Map({
    accessToken: container.dataset.token,
    container: 'map', // container ID
    // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
    style: 'mapbox://styles/mapbox/streets-v12', // style URL
    center: [Number.parseFloat(container.dataset.longitude), Number.parseFloat(container.dataset.latitude)], // starting position [lng, lat]
    zoom: Number.parseInt(container.dataset.zoom) // starting zoom
  })

  map.on('load', async () => {
    console.log('map loaded')
    map.addLayer({
      id: 'sample',
      type: 'circle',
      source: {
        type: 'geojson',
        data: '/export?format=geojson&first=2022-06-11&last=2022-06-17'
      }
    })
  })
})
