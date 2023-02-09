const dropTarget = document.getElementById('file-drop')

async function progress (url) {
  const response = await window.fetch(url)
  if (response.ok) {
    const result = await response.json()
    const template = document.createElement('template')
    template.innerHTML = result.html
    const parent = document.getElementById('ingest-progress')
    const child = document.getElementById(`d${result.id}`)
    if (child) {
      parent.replaceChild(template.content, child)
    } else {
      parent.appendChild(template.content)
    }
    if (result.complete) {
      document.getElementById(`d${result.id}`).classList.add('complete')
    } else {
      setTimeout(progress, 500, url)
    }
  } else {
    window.alert('fail')
  }
}

dropTarget.addEventListener('drop', async event => {
  event.preventDefault()
  event.target.classList.remove('active')
  event.target.classList.add('dropped')
  try {
    const items = Array.from(event.dataTransfer.items).filter(i => i.kind === 'file' && i.type === 'application/zip')
    if (items.length === 0) throw Error('no Flow data exports')
    const input = document.getElementById('measurements')
    const formData = new window.FormData()
    for (const item of items) {
      const file = item.getAsFile()
      formData.append(`${input.name}_${file.name}`.replace(/\W/g, ''), file)
    }
    const response = await window.fetch(input.formAction, {
      method: 'POST',
      mode: 'same-origin',
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      body: formData
    })
    if (response.ok) {
      (await response.json()).forEach(url => setTimeout(progress, 0, url))
    } else {
      throw Error(`${response.status} ${response.statusText}`)
    }
  } catch (err) {
    window.alert(err.message)
  }
  event.target.classList.remove('dropped')
}, { passive: false })

dropTarget.addEventListener('dragover', event => {
  event.preventDefault()
}, { passive: false })

dropTarget.addEventListener('dragenter', event => {
  event.target.classList.add('active')
}, { passive: true })

dropTarget.addEventListener('dragleave', event => {
  event.target.classList.remove('active')
}, { passive: true })
