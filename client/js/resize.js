/**
 * Redimensionnement
 */

/*
 * Vertical
 */

function initVerticalResize(e)
{
    verticalResizeProceeding = {
        "initial_h": bottomBar.offsetHeight,
        "initial_y": e.clientY
    };
    e.preventDefault();
}

function continueVerticalResize(e)
{
    if (!verticalResizeProceeding) return;
    var diff = e.clientY - verticalResizeProceeding["initial_y"];
    var newHeight = verticalResizeProceeding["initial_h"] - diff;
    if (newHeight > 0) {
        bottomBar.style.height = newHeight+"px";
    }
}

function stopVerticalResize(e)
{
    verticalResizeProceeding = null;
}

/*
 * Horizontal
 */

function initHorizontalResize(e)
{
    horizontalResizeProceeding = {
        "initial_w": rightBar.offsetWidth,
        "initial_x": e.clientX
    };
    continueHorizontalResize(e);
    filterForm.classList.add("null");
    e.preventDefault();
}

function continueHorizontalResize(e)
{
    if (!horizontalResizeProceeding) return;
    var diff = e.clientX - horizontalResizeProceeding["initial_x"];
    var newWidth = horizontalResizeProceeding["initial_w"] - diff;
    if (newWidth > 0) {
        rightBar.style.width = newWidth+"px";
    }
}

function stopHorizontalResize(e)
{
    horizontalResizeProceeding = null;
}

