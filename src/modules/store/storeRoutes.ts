// modules/store/storeRoutes.ts
import StoreLogin from './views/StoreLogin.vue'
import StoreRegister from './views/StoreRegister.vue'
import StoreProfile from './views/StoreProfile.vue'
import ProductManagement from './views/ProductManagement.vue'

export default [
  { path: '/store/login', component: StoreLogin },
  { path: '/store/register', component: StoreRegister },
  { path: '/store/profile', component: StoreProfile },
  { path: '/store/products', component: ProductManagement },
]
