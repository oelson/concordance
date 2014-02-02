/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la persistence des données saisies.
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

function saveFormState()
{
    // Mots clés & assimilés
    localStorage["tra"] = filterForm.elements["traduction"].value;
    localStorage["all"] = filterForm.elements["conjonction"].value;
    localStorage["one"] = filterForm.elements["quelconque"].value;
    localStorage["non"] = filterForm.elements["aucun"].value;
    localStorage["exp"] = filterForm.elements["expression"].value;
    localStorage["cas"] = filterForm.elements["case"].checked;
    localStorage["acc"] = filterForm.elements["accent"].checked;
    localStorage["bou"] = filterForm.elements["mot"].checked;
    localStorage["ran"] = filterForm.elements["nombres_min"].value + ","
                        + filterForm.elements["nombres_max"].value;
    var refs = [];
    for (var r in selectedReferences) {
        refs.push(r);
    }
    localStorage["ref"] = refs;
    // Options
    localStorage["uct"] = optionForm.elements["activer_comp_traduction"].checked;
    localStorage["cpt"] = optionForm.elements["traduction_comp"].value;
}

function restoreFormState()
{
    if ("tra" in localStorage) {
        filterForm.elements["traduction"].value = localStorage["tra"];
        lastTranslationUsed = localStorage["tra"];
    }
    if ("all" in localStorage) {
        filterForm.elements["conjonction"].value = localStorage["all"];
    }
    if ("one" in localStorage) {
        filterForm.elements["quelconque"].value = localStorage["one"];
    }
    if ("non" in localStorage) {
        filterForm.elements["aucun"].value = localStorage["non"];
    }
    if ("exp" in localStorage) {
        filterForm.elements["expression"].value = localStorage["exp"];
    }
    if ("cas" in localStorage) {
        filterForm.elements["case"].checked = (localStorage["cas"] == "true");
    }
    if ("acc" in localStorage) {
        filterForm.elements["accent"].checked = (localStorage["acc"] == "true");
    }
    if ("bou" in localStorage) {
        filterForm.elements["mot"].checked = (localStorage["bou"] == "true");
    }
    if ("ran" in localStorage) {
        var range = localStorage["ran"].split(",");
        filterForm.elements["nombres_min"].value = range[0];
        filterForm.elements["nombres_max"].value = range[1];
    }
    if ("ref" in localStorage && localStorage["ref"]) {
        var refs = localStorage["ref"].split(",");
        for (var i=0, s, reference; i < refs.length; ++i) {
            s = refs[i];
            addReference(s);
        }
    }
    // Options
    if ("uct" in localStorage) {
        optionForm.elements["activer_comp_traduction"].checked = (localStorage["uct"] == "true");
    }
    if ("cpt" in localStorage) {
        optionForm.elements["traduction_comp"].value = localStorage["cpt"];
        optionForm.elements["traduction_comp"].disabled = !optionForm.elements["activer_comp_traduction"].checked;
        toggleTranslationCompare();
    }
}

// Retaure éventuellement l'état précédent du formulaire
document.addEventListener("DOMContentLoaded", restoreFormState, false);
