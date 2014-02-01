/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à l'initialisation de tous les objets globaux de l'application.
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
 * TODO Faire apparaitre un spinner pour chaque requête, avec possibilité d'avorter une requète en cours + désactivation de l'interface
 * TODO Coder un message "aucun résultat n'a été trouvé + affichage conséquent dans le panneau de droite
 */

/**
 * Variables et objets globaux
 */

var bookListOl,
    filterForm,
    optionForm,
    resultTable,
    filterBar,
    referenceSection,
    launchButton,
    cleanButton,
    reinitButton,
    fullBibleReference,
    suggestionListSection,
    referenceErrorSpan,
    spinnerImg,
    suggestionCloseImg,
    bottomBar,
    rightBar,
    verticalResizeBar,
    horizontalResizeBar,
    contextTab,
    statistiqueTab,
    dictionnaryTab,
    statistiqueSection,
    dictionnarySection,
    termeModelTable,
    arrowBoxSection,
    measureBlockQuote,
    getDefinitionButton;

var selectedReferences  = {};

var searchVerseList  = {};

var lastTimestampReceived = null;
var connectInterval = null;
var focusedBookLi = null;
var oldFilterBarValue = "";
var lastTranslationUsed = null;

var verticalResizeProceeding,
    horizontalResizeProceeding;

var lastContextualQueryReference  = null,
    lastContextualQueryBlockQuote = null;

var activeReferenceLink = null;

 var accentMapping = [
    "ÀÁÂÄÆA",
    "àáâäæa",
    "ÈÉÊËE",
    "èéêëe",
    "ÌÍÎÏI",
    "ìíîïi",
    "ÑN",
    "ñn",
    "ÒÓÔÖO",
    "òóôöo",
    "ÙÚÛÜU",
    "ùúûüu"
];

var aLetterRegex = "[a-zA-Z" + accentMapping.join("") + "]";

var startsWithALetterRegex = new RegExp("^"+aLetterRegex);
var endWithALetterRegex = new RegExp(aLetterRegex+"$");
var isAWordReqex = new RegExp("^"+aLetterRegex+"+$");

/*
 * Récupère divers noeuds HTML dans des variables globales.
 */

function findElementsByIds()
{
    bookListOl = document.getElementById("book_list");
    filterForm = document.forms["filtre"];
    optionForm = document.forms["options"];
    resultTable = document.getElementById("resultats_recherche");
    launchButton = document.getElementById("lancer");
    cleanButton = document.getElementById("effacer");
    reinitButton = document.getElementById("reinitialiser");
    filterBar = document.getElementById("filtre_reference");
    referenceSection = document.getElementById("liste_reference");
    fullBibleReference = document.getElementById("bible_entiere");
    suggestionListSection = document.getElementById("suggestion_reference");
    referenceErrorSpan = document.getElementById("reference_error");
    spinnerImg = document.getElementById("spinner");
    suggestionCloseImg = document.getElementById("suggestion_close");
    bottomBar = document.getElementById("bottom");
    rightBar = document.getElementById("right");
    verticalResizeBar = document.getElementById("vertical-resize");
    horizontalResizeBar = document.getElementById("horizontal-resize");
    contextTab = document.getElementById("tab-context");
    statistiqueTab = document.getElementById("tab-stat");
    dictionnaryTab = document.getElementById("tab-dict");
    // Statistiques d'une recherche
    statistiqueSection = document.getElementById("statistique");
    // Dictionnaire
    dictionnarySection = document.getElementById("dictionnary");
    termeModelTable = document.getElementById("terme-model");
    termeModelTable.removeAttribute("id");
    // Boîte de dialogue fléchée
    arrowBoxSection = document.getElementById("arrow-box");
    measureBlockQuote = document.getElementById("measure");
    getDefinitionButton = document.getElementById("get-definition");
}

/*
 * Connecte chacun des éléments dynamiques de la page à ses différents
 * écouteurs.
 * Restaure éventuellement l'ancien étant du formulaire, puis tente une
 * connexion avec le serveur websocket.
 */

function init()
{
    // Trouve divers éléments du DOM
    findElementsByIds();
    // Formulaire de recherche
    filterForm.addEventListener("submit", function(e) {
        e.preventDefault();
        requestServerForSearch();
    }, false);
    // Champs de filtrage par mots-clés
    var requiredInputs = filterForm.getElementsByClassName("required");
    for (var i=0, inp; i < requiredInputs.length; ++i) {
        inp = requiredInputs[i];
        // Le bouton de recherche n'est activé que dans le cas où un mot-clé est
        // saisis (et si la connection est active)
        inp.addEventListener("keyup", toggleLaunchButton, false);
    }
    // Barre de recherche des références
    filterBar.addEventListener("keyup", handleFilterBarKeyUp, false);
    filterBar.addEventListener("keydown", handleFilterBarKeyDown, false);
    // Essaye de valider la référence en cours si jamais le focus part
    filterBar.addEventListener("blur", function(e) {
        hideBookSuggestion();
        submitReference();
    }, false);
    // Selectionne un nom de livre par click dans la boîte à suggestions
    var list = bookListOl.children, n=0;
    for (var i=0, li; i < list.length; ++i) {
        li = list[i];
        li.addEventListener("mousedown", function(e) {
            selectBookItem(this);
            e.preventDefault();
        }, false);
    }
    // Ferme la boîte à suggestions
    suggestionCloseImg.addEventListener("click", hideBookSuggestion, false);
    // Gestion de l'intervalle de nombres
    filterForm.elements["nombres_min"].addEventListener("change", handleMinMaxValuesChange, false);
    filterForm.elements["nombres_max"].addEventListener("change", handleMinMaxValuesChange, false);
    // Réinitialisation du formulaire
    reinitButton.addEventListener("click", function(e) {
        reinitForm();
    }, false);
    // Nettoyage des résultats de la recherche
    cleanButton.addEventListener("click", function(e) {
        cleanSearchList();
        cleanContextSection();
    }, false);
    // Redimensionnement vertical
    verticalResizeBar.addEventListener("mousedown", initVerticalResize, false);
    window.addEventListener("mousemove", continueVerticalResize, false);
    window.addEventListener("mouseup", stopVerticalResize, false);
    // Redimensionnement horizontal
    horizontalResizeBar.addEventListener("mousedown", initHorizontalResize, false);
    window.addEventListener("mousemove", continueHorizontalResize, false);
    window.addEventListener("mouseup", stopHorizontalResize, false);
    // Onglets
    contextTab.addEventListener("click", showContextTab, false);
    dictionnaryTab.addEventListener("click", showDictionnaryTab, false);
    // Retaure éventuellement l'état précédent du formulaire
    restoreFormState();
    // Obtient la définition du mot sélectionné
    getDefinitionButton.addEventListener("click", function(e) {
        // Le mot sélectionné aura préalablement été sauvé dans l'objet
        requestServerForDictionnary(this.word);
    }, false);
    // Connection au serveur Websocket
    connectToServer();
}

document.addEventListener("DOMContentLoaded", init, false);

// permet de filtrer les éléments nuls avec la méthode "Array.filter"
function ret(e) { return e; }

/**
 * Surcharge du code Javascript natif.
 */

/*
 * Vide un élément.
 */

HTMLElement.prototype.clear = function()
{
    if (this.firstChild) {
        while (this.firstChild) {
            this.removeChild(this.firstChild);
        }
        return true;
    }
    return false;
}

/*
 * Retourne les coordonnées absolues d'un élément.
 */

HTMLElement.prototype.getAbsoluteCoordinates = function()
{
    var x=0, y=0, el = this;
    while (el) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent;
    }
    return {"x": x, "y": y};
}
