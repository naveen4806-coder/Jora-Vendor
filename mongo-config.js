/* Public API address only. Never add Atlas credentials or JWT secrets here. */
window.JORA_API_CONFIG = {
  url: localStorage.getItem('jora_api_url') || 'http://127.0.0.1:4000/api'
};
