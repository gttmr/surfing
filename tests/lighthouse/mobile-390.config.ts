const mobile390Config = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttlingMethod: "simulate",
  },
};

export default mobile390Config;
