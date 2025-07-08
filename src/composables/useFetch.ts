import { ref } from "vue";
import api from "@/services/api";

export function useFetch<T = any>(
  url: string,
  { method = "get", immediate = false } = {}
) {
  const data = ref(null);
  const error = ref(null);
  const loading = ref(false);

  const fetchData = async (params = null, config = {}) => {
    loading.value = true;
    error.value = null;
    try {
      let response;

      if (method.toLowerCase() === "get") {
        response = await api.get(url, { params, ...config });
      } else if (method.toLowerCase() === "post") {
        response = await api.post(url, params, config);
      } else {
        throw new Error(`Método HTTP no soportado: ${method}`);
      }

      data.value = response.data;
    } catch (err: any) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  if (immediate) {
    fetchData();
  }

  return { data, error, loading, fetchData };
}
