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
})
