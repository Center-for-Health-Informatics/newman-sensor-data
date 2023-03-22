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
    zoom: 10 // starting zoom
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
      if ('Mg' in p && p.Mg > 0) t.push(`<tr><th>Mg</th><td>${p.Mg.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Al' in p && p.Al > 0) t.push(`<tr><th>Al</th><td>${p.Al.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Si' in p && p.Si > 0) t.push(`<tr><th>Si</th><td>${p.Si.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('P' in p && p.P > 0) t.push(`<tr><th>P</th><td>${p.P.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('S' in p && p.S > 0) t.push(`<tr><th>S</th><td>${p.S.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Cl' in p && p.Cl > 0) t.push(`<tr><th>Cl</th><td>${p.Cl.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Ca' in p && p.Ca > 0) t.push(`<tr><th>Ca</th><td>${p.Ca.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Ti' in p && p.Ti > 0) t.push(`<tr><th>Ti</th><td>${p.Ti.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('V' in p && p.V > 0) t.push(`<tr><th>V</th><td>${p.V.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Cr' in p && p.Cr > 0) t.push(`<tr><th>Cr</th><td>${p.Cr.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Mn' in p && p.Mn > 0) t.push(`<tr><th>Mn</th><td>${p.Mn.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Fe' in p && p.Fe > 0) t.push(`<tr><th>Fe</th><td>${p.Fe.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Co' in p && p.Co > 0) t.push(`<tr><th>Co</th><td>${p.Co.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Ni' in p && p.Ni > 0) t.push(`<tr><th>Ni</th><td>${p.Ni.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Cu' in p && p.Cu > 0) t.push(`<tr><th>Cu</th><td>${p.Cu.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Zn' in p && p.Zn > 0) t.push(`<tr><th>Zn</th><td>${p.Zn.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('As' in p && p.As > 0) t.push(`<tr><th>As</th><td>${p.As.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Se' in p && p.Se > 0) t.push(`<tr><th>Se</th><td>${p.Se.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Rb' in p && p.Rb > 0) t.push(`<tr><th>Rb</th><td>${p.Rb.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Sr' in p && p.Sr > 0) t.push(`<tr><th>Sr</th><td>${p.Sr.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Y' in p && p.Y > 0) t.push(`<tr><th>Y</th><td>${p.Y.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Zr' in p && p.Zr > 0) t.push(`<tr><th>Zr</th><td>${p.Zr.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Nb' in p && p.Nb > 0) t.push(`<tr><th>Nb</th><td>${p.Nb.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Mo' in p && p.Mo > 0) t.push(`<tr><th>Mo</th><td>${p.Mo.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Ag' in p && p.Ag > 0) t.push(`<tr><th>Ag</th><td>${p.Ag.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Cd' in p && p.Cd > 0) t.push(`<tr><th>Cd</th><td>${p.Cd.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Sn' in p && p.Sn > 0) t.push(`<tr><th>Sn</th><td>${p.Sn.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Sb' in p && p.Sb > 0) t.push(`<tr><th>Sb</th><td>${p.Sb.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('W' in p && p.W > 0) t.push(`<tr><th>W</th><td>${p.W.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Hg' in p && p.Hg > 0) t.push(`<tr><th>Hg</th><td>${p.Hg.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Pb' in p && p.Pb > 0) t.push(`<tr><th>Pb</th><td>${p.Pb.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Bi' in p && p.Bi > 0) t.push(`<tr><th>Bi</th><td>${p.Bi.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('Th' in p && p.Th > 0) t.push(`<tr><th>Th</th><td>${p.Th.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('U' in p && p.U > 0) t.push(`<tr><th>U</th><td>${p.U.toLocaleString()}</td><td>ppm</td></tr>`)
      if ('LE' in p && p.LE > 0) t.push(`<tr title="light elements"><th>LE</th><td>${p.LE.toLocaleString()}</td><td>ppm</td></tr>`)
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
