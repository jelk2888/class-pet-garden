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
import ClassManage from '@/pages/ClassManage.vue'
import LevelRules from '@/pages/manage/LevelRules.vue'
import TeachersManage from '@/pages/manage/TeachersManage.vue'
import BadgesManage from '@/pages/manage/BadgesManage.vue'
import ClassSettings from '@/pages/manage/ClassSettings.vue'
import Seating from '@/pages/Seating.vue'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/overview', name: 'overview', component: Overview },
    { path: '/wizard', name: 'wizard', component: Wizard },
    { path: '/', name: 'home', component: Home },
    { path: '/tasks', name: 'tasks', component: Tasks },
    { path: '/shop', name: 'shop', component: Shop },
    { path: '/honors', name: 'honors', component: Honors },
    { path: '/toolbox', name: 'toolbox', component: Toolbox },
    { path: '/seating', name: 'seating', component: Seating },
    { path: '/preview', name: 'preview', component: PetPreview },
    { path: '/ranking', name: 'ranking', component: Ranking },
    { path: '/records', name: 'records', component: Records },
    { path: '/admin', name: 'admin', component: Admin },
    { path: '/posts', name: 'posts', component: Posts },

    {
      path: '/manage',
      component: ClassManage,
      children: [
        { path: '', redirect: '/manage/students' },
        { path: 'students', name: 'manage-students', component: Students, meta: { embed: true } },
        { path: 'rules', name: 'manage-rules', component: Settings, meta: { embed: true, tab: 'rules' } },
        { path: 'levels', name: 'manage-levels', component: LevelRules },
        { path: 'groups', name: 'manage-groups', component: Groups, meta: { embed: true } },
        { path: 'teachers', name: 'manage-teachers', component: TeachersManage },
        { path: 'badges', name: 'manage-badges', component: BadgesManage },
        { path: 'class', name: 'manage-class', component: ClassSettings },
      ],
    },

    // 兼容旧链接 → 班级管理
    { path: '/students', redirect: '/manage/students' },
    { path: '/groups', redirect: '/manage/groups' },
    // 完整规则/标签/复活页仍保留
    { path: '/settings', name: 'settings', component: Settings },
  ]
})

export default router
