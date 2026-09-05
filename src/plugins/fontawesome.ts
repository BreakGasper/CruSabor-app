// src/plugins/fontawesome.ts
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faHeart as farHeart } from "@fortawesome/free-regular-svg-icons"; // 🤍 vacío

import {
  faPlus,
  faMinus,
  faTrashCan,
  faCoffee,
  faShoppingCart,
  faBan,
  faHeart as fasHeart, 
} from "@fortawesome/free-solid-svg-icons";

library.add(faPlus, faMinus, faTrashCan, faCoffee, faShoppingCart, faBan, fasHeart, farHeart);

export { FontAwesomeIcon };
