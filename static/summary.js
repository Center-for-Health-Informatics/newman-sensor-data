/* global mapboxgl */
const layerIDs = new Set()
const mapID = 'map'

window.addEventListener('DOMContentLoaded', () => {
  const map = createMap(mapID)

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
    center: [-84.5, 39.14], // starting position [lng, lat]
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
    console.log(`${document.getElementById(mapID).dataset.source}?format=geojson&month=${month}`)
    map.addLayer({
      id: `measurements-${month}`,
      type: 'circle',
      source: {
        type: 'geojson',
        data: `${document.getElementById(mapID).dataset.source}?format=geojson&month=${month}`
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
          'Low',
          '#1dcfff',
          'Moderate',
          '#8edb33',
          'High',
          '#fd891a',
          'Very High',
          '#e13366',
          'Excessive',
          '#a828d3',
          'Extreme',
          '#8919e9',
          'Airpocalypse',
          '#6a0bff',
          '#808080'
        ]
      }
    })
    map.on('click', layerID, event => {
      const p = event.features[0].properties
      const t = [`<table><caption style="white-space: nowrap">${p.datetime}</caption><tbody>`]
      if ('no2' in p) t.push(`<tr><th>NO₂</th><td>${p.no2}</td><td>ppb</td></tr>`)
      if ('voc' in p) t.push(`<tr><th>VOC</th><td>${p.voc}</td><td>ppb</td></tr>`)
      if ('pm10' in p) t.push(`<tr><th>pm 10</th><td>${p.pm10}</td><td>µg/m³</td></tr>`)
      if ('pm25' in p) t.push(`<tr><th>pm 2.5</th><td>${p.pm25}</td><td>µg/m³</td></tr>`)
      if ('pm1' in p) t.push(`<tr><th>pm 1</th><td>${p.pm1}</td><td>µg/m³</td></tr>`)
      if ('aqi' in p) t.push(`<tr><th>AQI</th><td colspan="2">${p.aqi}</td></tr>`)
      if ('pm' in p) t.push(`<tr><th>PM</th><td>${p.pm}</td><td>µg/m³</td></tr>`)
      if ('temperature' in p) t.push(`<tr><th>Temp</th><td>${p.temperature}</td><td>°F</td></tr>`)
      if ('soundlevel' in p) t.push(`<tr><th>SL</th><td>${p.soundlevel}</td><td>db</td></tr>`)
      if ('humidity' in p) t.push(`<tr><th>RH</th><td>${p.humidity}</td><td>%</td></tr>`)
      t.push('</tbody></table>')
      new mapboxgl.Popup()
        .setLngLat([event.lngLat.lng, event.lngLat.lat])
        .setHTML(t.join(''))
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
