/* global mapboxgl */
const layerIDs = new Set()

window.addEventListener('DOMContentLoaded', () => {
  const map = createMap('map')

  map.on('load', () => {
    updateMap(map)
  })

  document.getElementById('month').addEventListener('change', _event => updateMap(map), { passive: true })
  document.getElementById('year').addEventListener('change', _event => updateMap(map), { passive: true })
  document.getElementById('previous').addEventListener('click', _event => {
    let newmonth = Number.parseInt(document.getElementById('month').value) - 1
    let newyear = Number.parseInt(document.getElementById('year').value)
    if (newmonth < 1) {
      newmonth = 12
      newyear -= 1
    }
    document.getElementById('month').value = newmonth
    document.getElementById('year').value = newyear
    updateMap(map)
  }, { passive: true })
  document.getElementById('next').addEventListener('click', _event => {
    let newmonth = Number.parseInt(document.getElementById('month').value) + 1
    let newyear = Number.parseInt(document.getElementById('year').value)
    if (newmonth > 12) {
      newmonth = 1
      newyear += 1
    }
    document.getElementById('month').value = newmonth
    document.getElementById('year').value = newyear
    updateMap(map)
  }, { passive: true })
})

function createMap (id) {
  const container = document.getElementById(id)
  return new mapboxgl.Map({
    accessToken: container.dataset.token,
    container: id, // container ID
    style: 'mapbox://styles/mapbox/streets-v12', // style URL
    center: [-84.5036, 39.1396], // starting position [lng, lat]
    zoom: 11 // starting zoom
  })
}

function updateMap (map) {
  normalizePicker()
  const month = [document.getElementById('year').value, document.getElementById('month').value].join('-')
  const layerID = `measurements-${month}`
  if (layerIDs.has(layerID)) {
    layerIDs.forEach(id => map.setLayoutProperty(id, 'visibility', id === layerID ? 'visible' : 'none'))
  } else {
    layerIDs.forEach(id => map.setLayoutProperty(id, 'visibility', 'none'))
    map.addLayer({
      id: `measurements-${month}`,
      type: 'circle',
      source: {
        type: 'geojson',
        data: `/export?format=geojson&month=${month}`
      },
      paint: {
        'circle-radius': {
          base: 2,
          stops: [
            [12, 4],
            [22, 180]
          ]
        },
        'circle-color': [
          'match',
          ['get', 'aqi'],
          'low',
          '#1dcfff',
          'moderate',
          '#8edb33',
          'high',
          '#fd891a',
          'very high',
          '#fd891a',
          'excessive',
          '#a828d3',
          'extreme',
          '#8919e9',
          'airpocalypse',
          '#6a0bff',
          '#808080'
        ]
      }
    })
    map.on('click', layerID, event => {
      const p = event.features[0].properties
      new mapboxgl.Popup()
        .setLngLat([event.lngLat.lng, event.lngLat.lat])
        .setHTML(`<table><caption>${p.datetime}</caption><tbody><tr><th>NO₂</th><td>${p.no2}</td><td>ppb</td></tr><tr><th>VOC</th><td>${p.voc}</td><td>ppb</td></tr><tr><th>pm 10</th><td>${p.pm10}</td><td>µg/m³</td></tr><tr><th>pm 2.5</th><td>${p.pm25}</td><td>µg/m³</td></tr><tr><th>pm 1</th><td>${p.pm1}</td><td>µg/m³</td></tr></tbody></table>`)
        .addTo(map)
    })
    layerIDs.add(layerID)
  }
}

function normalizePicker () {
  const e = {
    year: document.getElementById('year'),
    month: document.getElementById('month'),
    controls: document.getElementById('month-controls')
  }
  const d = 100 * Number.parseInt(e.year.value) + Number.parseInt(e.month.value)
  if (d < 100 * Number.parseInt(e.controls.dataset.minYear) + Number.parseInt(e.controls.dataset.minMonth)) {
    e.year.value = e.controls.dataset.minYear
    e.month.value = e.controls.dataset.minMonth
  } else if (d > 100 * Number.parseInt(e.controls.dataset.maxYear) + Number.parseInt(e.controls.dataset.maxMonth)) {
    e.year.value = e.controls.dataset.maxYear
    e.month.value = e.controls.dataset.maxMonth
  }
}
