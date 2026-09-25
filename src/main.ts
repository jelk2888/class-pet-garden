import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import './styles/themes.css'
import { refreshPetTypes } from './data/pets'

refreshPetTypes()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
