/**
 * Concordance biblique intégrant un outil de recherche et le dictionnaire
 * "Le Littré".
 * 
 * Fichier dédié à la gestion du protocole applicatif (recherche de définition).
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
 * Procède à une demande de définition dans le dictionnaire.
 */
 
function requestServerForDictionnary(word)
{
    if (!s) return;
    var dict = {
        "now": new Date().getTime(),
        "tok": "dictionnary",
        "word": word
    };
    var jsonData = JSON.stringify(dict);
    s.send(jsonData);
}

/*
 * Ajouter un titre de table (sens n°1, 2, etc...)
 */

function buildTableHead(table, index)
{
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    var th = document.createElement("th");
    th.setAttribute("colspan", 2);
    th.appendChild(document.createTextNode("Sens n°"+index));
    tr.appendChild(th);
    thead.appendChild(tr);
    table.appendChild(thead);
}

/*
 * Fonction de manipulation des réponses du serveur concernant les recherches
 * dans le dictionnaire.
 */

function handleDictionnaryResponse(dom)
{
    var root = dom.documentElement;
    var entries = root.getElementsByTagName("entree"), entry, entryOl, table,
        tbody, corps;
    for (var i=0; i < entries.length; ++i) {
        entry = entries[i];
        table = termeModelTable.cloneNode(true);
        tbody = table.tBodies[0];
        if (entries.length > 1) {
            buildTableHead(table, i);
        }
        handleEntete(
            entry.getAttribute("terme"),
            entry.getElementsByTagName("entete")[0],
            tbody
        );
        corps = entry.getElementsByTagName("corps")[0];
        handleVariantes(corps, tbody);
        handleSynonymes(entry, tbody);
        handleRemarques(entry, tbody);
        handleEtymoligie(entry, tbody);
        handleHistorique(entry, tbody);
        handleSupplements(entry, tbody);
        // Vide premièrement la section puis ajoute la nouvelle définition
        dictionnarySection.clear();
        dictionnarySection.appendChild(table);
    }
    hideArrowBox();
    showDictionnaryTab();
}

/*
 * Effectue une correspondance entre l'entête d'une entrée du XMLittré et une
 * table HTML de présentation, représentée ici par son corps "tbody".
 * Le terme de l'entrée est donné en premier argument (chaîne de car.)
 */

function handleEntete(terme, entete, tbody)
{
    var termeRow  = tbody.getElementsByClassName("terme")[0];
    var natureRow = tbody.getElementsByClassName("nature")[0];
    var prononRow = tbody.getElementsByClassName("prononciation")[0];
    var termeCell = termeRow.getElementsByTagName("td")[1];
    var natureCell = natureRow.getElementsByTagName("td")[1];
    var prononCell = prononRow.getElementsByTagName("td")[1];
    termeCell.appendChild(document.createTextNode(terme));
    prononCell.appendChild(entete.getElementsByTagName("prononciation")[0].firstChild);
    natureCell.appendChild(entete.getElementsByTagName("nature")[0].firstChild);
    termeRow.classList.remove("gone");
    prononRow.classList.remove("gone");
    natureRow.classList.remove("gone");
}

/*
 * Traite les synonymes de la définition
 */

function handleSynonymes(entree, tbody)
{
    var synRow = tbody.getElementsByClassName("synonymes")[0];
    var synCell = synRow.getElementsByTagName("td")[1];
    var xpr = document.evaluate(
        "./rubrique[@nom='SYNONYME']",
        entree,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    // Itère sur les remarques
    var synList;
    for (var syn = xpr.iterateNext(); syn; syn = xpr.iterateNext()) {
        synList = handleIndents(syn);
        synCell.appendChild(synList);
    }
    if (synCell.firstChild) {
        synRow.classList.remove("gone");
    }
}

/*
 * Traite les remarques de la définition
 */

function handleRemarques(entree, tbody)
{
    var remRow = tbody.getElementsByClassName("remarques")[0];
    var remCell = remRow.getElementsByTagName("td")[1];
    var xpr = document.evaluate(
        "./rubrique[@nom='REMARQUE']",
        entree,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    // Itère sur les remarques
    var remList;
    for (var rem = xpr.iterateNext(); rem; rem = xpr.iterateNext()) {
        remList = handleIndents(rem);
        remCell.appendChild(remList);
    }
    if (remCell.firstChild) {
        remRow.classList.remove("gone");
    }
}

/*
 * Traite l'étymologie d'une définition
 */

function handleEtymoligie(entree, tbody)
{
    var etyRow = tbody.getElementsByClassName("etymologie")[0];
    var etyCell = etyRow.getElementsByTagName("td")[1];
    var xpr = document.evaluate(
        "./rubrique[@nom='ÉTYMOLOGIE']",
        entree,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    // Itère sur les étymologies
    var etyList;
    for (var ety = xpr.iterateNext(); ety; ety = xpr.iterateNext()) {
        etyList = handleIndents(ety);
        etyCell.appendChild(etyList);
    }
    if (etyCell.firstChild) {
        etyRow.classList.remove("gone");
    }
}

/*
 * Traite l'historique d'une définition
 */

function handleHistorique(entree, tbody)
{
    var hisRow = tbody.getElementsByClassName("historique")[0];
    var hisCell = hisRow.getElementsByTagName("td")[1];
    var xpr = document.evaluate(
        "./rubrique[@nom='HISTORIQUE']",
        entree,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    // Itère sur les étymologies
    var hisList;
    for (var his = xpr.iterateNext(); his; his = xpr.iterateNext()) {
        hisList = handleIndents(his);
        hisCell.appendChild(hisList);
    }
    if (hisCell.firstChild) {
        hisRow.classList.remove("gone");
    }
}

/*
 * Traite les supplément au dictionnaire.
 */

function handleSupplements(entree, tbody)
{
    var supRow = tbody.getElementsByClassName("supplements")[0];
    var supCell = supRow.getElementsByTagName("td")[1];
    var xpr = document.evaluate(
        "./rubrique[@nom='SUPPLÉMENT AU DICTIONNAIRE']",
        entree,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    // Itère sur les étymologies
    var supList, supVars;
    for (var sup = xpr.iterateNext(); sup; sup = xpr.iterateNext()) {
        supList = handleIndents(sup);
        //supVars = handleVariantes(sup);
        supCell.appendChild(supList);
        //supCell.appendChild(supVars);
    }
    if (supCell.firstChild) {
        supRow.classList.remove("gone");
    }
}

/*
 * Parcours les variantes d'une entrée et les représente au sein d'une table,
 * représentée ici par son corps "tbody".
 */

function handleVariantes(corps, tbody)
{
    var variantes = corps.getElementsByTagName("variante");
    var varRow = tbody.getElementsByClassName("variantes")[0];
    var varCell = varRow.getElementsByTagName("td")[1];
    var olVar = document.createElement("ol"), liDef;
    var label;
    var indentsUl, indentLi, cits, citsUl;

    olVar.classList.add("foldable");
    
    // Boucle sur les variantes de la définition
    for (var i=0, variante; i < variantes.length; ++i) {
        variante = variantes[i];
        liDef = document.createElement("li");
        
        // Le libellé de la variante peut être contenu dans un ensemble de
        // noeuds et de noeuds texte, situés les uns derrière les autres
        label = getRootText(variante, ["semantique"]);
        liDef.appendChild(document.createTextNode(label));

        // Traite les éventuelles citations
        cits = getCitations(variante);
        if (cits.length > 0) {
            citsUl = document.createElement("ul");
            for (var j=0, citLi; j < cits.length; ++j) {
                citLi = cits[j];
                citsUl.appendChild(citLi);
            }
            liDef.appendChild(citsUl);
        }

        // Récupère les indentations
        indentsUl = handleIndents(variante);
        if (indentsUl) {
            liDef.appendChild(indentsUl)
        }

        // Active le dépliement des sous-listes
        if (liDef.childElementCount > 0) {
            liDef.addEventListener("click", function(e) {
                // N'admet de basculer le pliage que sur le clic du <li>
                if (e.target != this) return;
                this.classList.toggle("unfolded");
            }, false);
        } else {
            liDef.classList.add("lonely");
        }
        olVar.appendChild(liDef);
    }
    
    varCell.appendChild(olVar);
    if (variantes.length > 0) {
        varRow.classList.remove("gone");
    }
}

/*
 * Gestion des "indent", à savoir la structure de la définition
 */

function handleIndents(parent)
{
    var xpr = document.evaluate(
        "./indent",
        parent,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var indList, indentLi, cits, citsUl, text, numericList = false;
    for (var indent = xpr.iterateNext(); indent; indent = xpr.iterateNext()) {
        text = getRootText(indent);
        if (!indList) {
            // Construit une liste de type numérique ou non selon le préfixe
            numericList = text.search(/^\d+\./) != -1;
            if (numericList) {
                indList = document.createElement("ol");
            } else {
                indList = document.createElement("ul");
            }
            indList.classList.add("indent");
        }
        // Retranche l'indice numérique du texte
        if (numericList) {
            text = text.replace(/^\d+\.\s+/, "");
        }
        indentLi = document.createElement("li");
        // Obtient uniquement le texte à la racine
        indentLi.appendChild(document.createTextNode(text));
        // Traite les éventuelles citations imbriquées
        cits = getCitations(indent);
        if (cits.length > 0) {
            citsUl = document.createElement("ul");
            for (var i=0, citLi; i < cits.length; ++i) {
                citLi = cits[i];
                citsUl.appendChild(citLi);
            }
            indentLi.appendChild(citsUl);
        }
        // Ajoute l'indentation à la liste
        indList.appendChild(indentLi);
    }
    return indList;
}

/*
 * Récupère la concaténation des noeuds texte situés à la racine d'un élément.
 * Conçu pour remplacer "element.textContent", qui est récursif.
 */

function getRootText(element, allowedTags)
{
    var xpathExpr = "./text()";
    // Ajoute une liste de tags à inspécter depuis la racine
    if (allowedTags) {
        xpathExpr = "("+xpathExpr;
        for (var i=0; i < allowedTags.length; ++i) {
            xpathExpr += "| ./"+allowedTags[i]+"/text()";
        }
        xpathExpr = xpathExpr+")";
    }
    var xpr = document.evaluate(
        xpathExpr,
        element, 
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var tmp;
    var text = "";
    do {
        tmp = xpr.iterateNext();
        if (tmp) {
            text += tmp.nodeValue.replace(/\n+/g, " ");
        }
    }
    while (tmp);
    return text;
}

/*
 * Retourne un noeud HTML <li> bâti à partir d'une citation
 * d'une entrée.
 */

function buildCitation(cit)
{
    var li, u, q, aut, ref, txt;
    
    aut = cit.getAttribute("aut");
    ref = cit.getAttribute("ref");
    txt = cit.textContent;

    li = document.createElement("li");
    
    if (aut) {
        li.appendChild(document.createTextNode(aut));
    }
    if (ref) {
        if (aut) {
            li.appendChild(document.createTextNode(", "));
        }
        u = document.createElement("u");
        u.appendChild(document.createTextNode(ref));
        li.appendChild(u);
    }
    
    if (aut || ref) {
        li.appendChild(document.createTextNode(" : "));
    }

    if (txt) {
        q = document.createElement("q");
        q.appendChild(document.createTextNode(txt));
        li.appendChild(q);
    }

    return li;
}

/*
 * Retourne une liste de noeuds <li> représentant les citations
 * trouvées dans le noeud parent.
 */

function getCitations(parent)
{
    var listElements = [];
    var xpr = document.evaluate(
        "./cit",
        parent,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );
    var cit, li;
    do {
        cit = xpr.iterateNext();
        if (!cit) continue;
        li = buildCitation(cit);
        listElements.push(li);
    }
    while (cit);
    
    return listElements;
}
