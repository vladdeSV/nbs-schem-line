import { convertNBSToSchem } from '../web/converter.ts'

// elements
const uploadArea = document.querySelector('.upload-area') as HTMLElement
const uploadInput = document.querySelector('.upload-input') as HTMLInputElement
const resultText = document.querySelector('.result-text') as HTMLElement
const timingSelect = document.querySelector('.timing-select') as HTMLSelectElement
const convertButton = document.querySelector('.convert-button') as HTMLButtonElement

// state
type UploadState = 'empty' | 'dragging' | 'success' | 'error'

function setState(state: UploadState) {
  uploadArea.dataset.state = state
}

function validateFile(file: File): boolean {
  return file.name.endsWith('.nbs')
}

function handleFileSelect(file: File) {
  if (validateFile(file)) {
    resultText.textContent = file.name
    setState('success')
    convertButton.disabled = false
  } else {
    resultText.textContent = 'error: only .nbs files are accepted'
    setState('error')
    convertButton.disabled = true
  }
}
// prevent browser default file handling
;['dragenter', 'dragover', 'drop'].forEach(eventName => {
  document.body.addEventListener(eventName, e => {
    e.preventDefault()
    e.stopPropagation()
  })
})

// file input change
uploadInput.addEventListener('change', () => {
  const file = uploadInput.files?.[0]
  if (file) {
    handleFileSelect(file)
  }
})

// drag and drop
uploadArea.addEventListener('dragenter', () => {
  setState('dragging')
})

uploadArea.addEventListener('dragleave', e => {
  if (e.target === uploadArea) {
    const currentState = uploadArea.dataset.state as UploadState
    if (currentState === 'dragging') {
      setState('empty')
    }
  }
})

uploadArea.addEventListener('drop', e => {
  e.preventDefault()

  const file = (e as DragEvent).dataTransfer?.files[0]
  if (file) {
    // sync with input element
    const dt = new DataTransfer()
    dt.items.add(file)
    uploadInput.files = dt.files

    handleFileSelect(file)
  }
})

// allow clicking anywhere to trigger upload
// (the input already handles this, no additional logic needed)

// convert
convertButton.addEventListener('click', async () => {
  const file = uploadInput.files?.[0]
  if (!file) return

  try {
    resultText.textContent = 'converting...'
    convertButton.disabled = true

    const arrayBuffer = await file.arrayBuffer()
    const useFixedSpacing = timingSelect.value === 'fixed'

    console.log('converting file:', file.name)
    console.log('timing adjustment:', timingSelect.value)

    const schemData = await convertNBSToSchem(arrayBuffer, useFixedSpacing)

    const blob = new Blob([schemData], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace(/\.nbs$/, '.schem')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    resultText.textContent = 'conversion complete, downloading...'
  } catch (error) {
    resultText.textContent = `error: ${error}`
    console.error(error)
  } finally {
    convertButton.disabled = false
  }
})
