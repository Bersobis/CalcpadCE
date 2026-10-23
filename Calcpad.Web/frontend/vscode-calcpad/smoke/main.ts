// Smoke harness for the Live math editor: mounts the real CalcpadLiveMath panel at sidebar
// width with a real worksheet and mirrors the document into #doc so a driver can assert that
// palette clicks reach the text. Not part of the extension build.
import { createApp, h, nextTick, ref, watch } from 'vue'
import CalcpadLiveMath from '../../calcpad-frontend/src/vue/components/CalcpadLiveMath.vue'
import '../../calcpad-frontend/src/vue/styles/base.css'

const document_text = ref(`'Live editor smoke worksheet'
a = 5
b = 3
x = a^2 + b^2
y = sqrt(x)
M = [1; 2]
ratio = x/y
#hide`)

// The harness renders with `h`, not a template string: the extension bundles the runtime-only
// Vue build, so an in-DOM template would silently render nothing.
const app = createApp({
  setup() {
    return () => h(CalcpadLiveMath, {
      modelValue: document_text.value,
      'onUpdate:modelValue': (value: string) => { document_text.value = value },
    })
  },
})
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err, info)
}
app.mount('#app')

const docView = document.createElement('pre')
docView.id = 'doc'
docView.textContent = document_text.value
document.body.appendChild(docView)
watch(document_text, (value) => { docView.textContent = value })

nextTick(() => {
  ;(window as unknown as { __smokeReady: boolean }).__smokeReady = true
})
