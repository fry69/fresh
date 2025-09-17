let prev = new URL(location.href);

document.addEventListener("fresh:before-partial-update", (e) => {
  if (!document.startViewTransition) {
    return;
  }

  const next = new URL(location.href);
  const nextId = +next.pathname.split("/").pop();
  const prevId = +prev.pathname.split("/").pop();

  let className = "";
  if (!isNaN(nextId) && !isNaN(prevId)) {
    className = nextId > prevId ? "slide-forward" : "slide-backward";
  }

  prev = next;

  const transition = document.startViewTransition(() => {
    e.detail.update();
    document.documentElement.classList.remove("slide-forward", "slide-backward");
    document.documentElement.classList.add(className);
  });

  transition.finished.then(() => {
    document.documentElement.classList.remove("slide-forward", "slide-backward");
  })

  e.preventDefault();
});
