/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion des fonctionnalités de base de l'UI.
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
 * Réinitialise le formulaire:
 *   . efface les références affichées
 *   . efface les suggestions de livres
 *   . efface les champs du formulaire
 * Et sauvegarde ce nouvel état.
 */

function reinitForm()
{
    cleanReferenceList();
    filterForm.reset();
    optionForm.reset();
    localStorage.clear();
    toggleCleanButton();
    toggleLaunchButton();
}

/*
 * Soumission du formulaire
 */

function isFormSubmitable()
{
    // Refuse la soumission si aucun mot-clé n'est donné
    var requiredInputs = filterForm.getElementsByClassName("required");
    var isFormFilled = false;
    for (var i=0, inp; i < requiredInputs.length; ++i) {
        inp = requiredInputs[i];
        if (inp.value) {
            isFormFilled = true;
            break;
        }
    }
    if (!isFormFilled) {
        return false;
    }
    if (!s || s.readyState != WebSocket.OPEN) {
        return false;
    }
    return true;
}

/*
 * Retourne vrai lorsque des versets sont affichés.
 */

function isUICleanable()
{
    return resultTable.tBodies[0].childElementCount > 1;
}

/*
 * Active ou non le bouton de nettoyage de l'interface.
 */

function toggleCleanButton()
{
    cleanButton.disabled = !isUICleanable();
}

/*
 * Active ou non le bouton de recherche.
 */

function toggleLaunchButton()
{
    launchButton.disabled = !isFormSubmitable();
}

/*
 * Vérifie l'intégrité de l'intervalle des nombres.
 */

function handleMinMaxValuesChange(e)
{
    var isMinInput = this == filterForm.elements["nombres_min"];
    var min = parseInt(filterForm.elements["nombres_min"].value);
    var max = parseInt(filterForm.elements["nombres_max"].value);
    // la valeur minimale a changé
    if (isMinInput) {
        if (min == max) {
            filterForm.elements["nombres_max"].value = min+1;
        }
    }
    // la valeur maximale a changé
    else {
        if ((isNaN(min) && !isNaN(max)) || (min == max)) {
            filterForm.elements["nombres_min"].value = max-1;
        }
    }
}
