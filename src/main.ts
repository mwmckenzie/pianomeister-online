import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './ui/theme/fonts.css'
import './ui/theme/tokens.css'
import './ui/theme/base.css'

import App from './ui/App.vue'
import { router } from './ui/router/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
