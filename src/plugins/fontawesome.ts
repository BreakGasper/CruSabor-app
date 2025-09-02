// src/plugins/fontawesome.ts
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
  faPlus,
  faMinus,
  faTrashCan,
  faCoffee,
  faShoppingCart,
} from "@fortawesome/free-solid-svg-icons";

library.add(faPlus, faMinus, faTrashCan, faCoffee, faShoppingCart);

export { FontAwesomeIcon };
