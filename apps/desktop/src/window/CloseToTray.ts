export interface CloseToTrayOptions {
  readonly shouldHide: () => Promise<boolean>;
  readonly hide: () => void;
  readonly close: () => void;
}

export interface CloseToTrayHandler {
  readonly handleClose: (event: { preventDefault: () => void }) => void;
  /** Lets every later close through, so a Windows shutdown is never held up by a hidden window. */
  readonly approveClose: () => void;
}

// Electron decides a close synchronously but the setting is read asynchronously,
// so every close is held, then either hidden or replayed as an approved close.
export function makeCloseToTrayHandler(options: CloseToTrayOptions): CloseToTrayHandler {
  let closeApproved = false;

  const closeForReal = () => {
    closeApproved = true;
    options.close();
  };

  return {
    handleClose: (event) => {
      if (closeApproved) return;
      event.preventDefault();
      options.shouldHide().then((shouldHide) => {
        if (closeApproved) return;
        if (shouldHide) options.hide();
        else closeForReal();
      }, closeForReal);
    },
    approveClose: () => {
      closeApproved = true;
    },
  };
}
