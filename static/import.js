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

async function postFileList (files) {
  const formData = new window.FormData()
  let id = 0
  for (const file of files) {
    if (file.type !== 'application/zip') continue
    formData.append(`file${id++}_${file.name}`.replaceAll(/\W/g, ''), file)
  }
  if (id > 0) {
    const response = await window.fetch(document.getElementById('flow-ingest').dataset.action, {
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
  }
}

dropTarget.addEventListener('drop', async event => {
  event.preventDefault()
  event.target.classList.remove('active')
  event.target.classList.add('dropped')
  try {
    await postFileList(event.dataTransfer.files)
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

document.getElementById('flow-files').addEventListener('change', async event => {
  try {
    await postFileList(event.target.files)
    event.target.value = '' // reset the file input
  } catch (err) {
    window.alert(err.message)
  }
}, { passive: true })
