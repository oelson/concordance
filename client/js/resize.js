/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié aux deux types de redimensionnements de l'interface.
 * 
 * Copyright 2013 Houillon Nelson <houillon.nelson@gmail.com>
 * 
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *  MA 02110-1301, USA.
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

