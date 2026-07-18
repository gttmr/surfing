const mobile430Config = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 430,
      height: 932,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttlingMethod: "simulate",
  },
};

export default mobile430Config;
