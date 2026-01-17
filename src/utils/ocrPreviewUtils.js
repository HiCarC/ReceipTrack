export const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

export const fileFromPreview = async (previewImageSrc) => {
  const res = await fetch(previewImageSrc);
  const blob = await res.blob();
  return new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
};
