import { describe, expect, it, vi } from "vite-plus/test";

import { makeCloseToTrayHandler } from "./CloseToTray.ts";

function setup(shouldHide: () => Promise<boolean>) {
  const hide = vi.fn();
  const close = vi.fn();
  const preventDefault = vi.fn();
  const handler = makeCloseToTrayHandler({ shouldHide, hide, close });
  return { handler, hide, close, event: { preventDefault }, preventDefault };
}

describe("makeCloseToTrayHandler", () => {
  it("holds the close and hides the window when the tray should keep the app alive", async () => {
    const { handler, hide, close, event, preventDefault } = setup(() => Promise.resolve(true));

    handler.handleClose(event);
    await vi.waitFor(() => expect(hide).toHaveBeenCalledOnce());

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it.each([
    ["the tray should not keep the app alive", () => Promise.resolve(false)],
    ["the decision cannot be read", () => Promise.reject(new Error("unreadable"))],
  ])("replays a real close when %s", async (_name, shouldHide) => {
    const { handler, hide, close, event, preventDefault } = setup(shouldHide);

    handler.handleClose(event);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    handler.handleClose(event);

    expect(hide).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("never holds a close once it has been approved", () => {
    const shouldHide = vi.fn(() => Promise.resolve(true));
    const { handler, event, preventDefault } = setup(shouldHide);

    handler.approveClose();
    handler.handleClose(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(shouldHide).not.toHaveBeenCalled();
  });

  it("does not hide when the close is approved while the decision is pending", async () => {
    let finishDecision: (shouldHide: boolean) => void = () => undefined;
    const decision = new Promise<boolean>((resolve) => {
      finishDecision = resolve;
    });
    const { handler, hide, event } = setup(() => decision);

    handler.handleClose(event);
    handler.approveClose();
    finishDecision(true);
    await decision;

    expect(hide).not.toHaveBeenCalled();
  });
});
