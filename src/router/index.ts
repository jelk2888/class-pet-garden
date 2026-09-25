import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home.vue'
import Overview from '@/pages/Overview.vue'
import Honors from '@/pages/Honors.vue'
import Wizard from '@/pages/Wizard.vue'
import Tasks from '@/pages/Tasks.vue'
import Shop from '@/pages/Shop.vue'
import Groups from '@/pages/Groups.vue'
import Toolbox from '@/pages/Toolbox.vue'
import PetPreview from '@/pages/PetPreview.vue'
import Ranking from '@/pages/Ranking.vue'
import Settings from '@/pages/Settings.vue'
import Records from '@/pages/Records.vue'
import Students from '@/pages/Students.vue'
import Admin from '@/pages/Admin.vue'
import Posts from '@/pages/Posts.vue'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/overview', name: 'overview', component: Overview },
    { path: '/wizard', name: 'wizard', component: Wizard },
    { path: '/', name: 'home', component: Home },
    { path: '/tasks', name: 'tasks', component: Tasks },
    { path: '/shop', name: 'shop', component: Shop },
    { path: '/groups', name: 'groups', component: Groups },
    { path: '/honors', name: 'honors', component: Honors },
    { path: '/toolbox', name: 'toolbox', component: Toolbox },
    { path: '/preview', name: 'preview', component: PetPreview },
    { path: '/ranking', name: 'ranking', component: Ranking },
    { path: '/settings', name: 'settings', component: Settings },
    { path: '/records', name: 'records', component: Records },
    { path: '/students', name: 'students', component: Students },
    { path: '/admin', name: 'admin', component: Admin },
    { path: '/posts', name: 'posts', component: Posts }
  ]
})

export default router
