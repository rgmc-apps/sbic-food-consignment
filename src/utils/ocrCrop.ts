// Shared between OcrCropModal.vue (which applies this padding when building
// the crop) and SubmitPage.vue (which needs the same ratio to know how much
// of the final crop is padding vs. the user's actual selection, so it can
// exclude recognized text that only exists because of that padding). Keep
// both in sync — this is the single source of truth.
export const CROP_PAD_RATIO = 0.15;
