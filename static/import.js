const dropTarget = document.getElementById('file-drop')

dropTarget.addEventListener('drop', async event => {
  event.preventDefault()
  console.log('Drop')
  event.target.classList.remove('active')
  event.target.classList.add('dropped')
  try {
    Array.from(event.dataTransfer.items).forEach(item => console.log(item.type))
    const items = Array.from(event.dataTransfer.items).filter(i => i.kind === 'file' && i.type === 'application/zip')
    if (items.length === 0) throw Error('no Flow data exports')
    const input = document.getElementById('measurements')
    const formData = new window.FormData()
    for (const item of items) {
      const file = item.getAsFile()
      formData.append(`${input.name}_${file.name}`.replace(/\W/g, ''), file)
    }
    const result = await window.fetch(input.formAction, {
      method: 'POST',
      mode: 'same-origin',
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      body: formData
    })
    if (result.ok) {
      console.log(await result.text())
    } else {
      throw Error(`${result.status} ${result.statusText}`)
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
