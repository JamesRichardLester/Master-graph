/*
 widget - a automcomplete menu to select an employee

 requires: "https://www.google.com/jsapi" (Google Visualization)

 Links:

 Google Visualization API Reference - https://developers.google.com/chart/interactive/docs/reference
 - this is used to draw the actual line graph, along with the redraws/animations


        //JRL - I used most of the Seriesgraph code to grab the way you parse data so I could
        //      manipulate it and reinput it into highcharts.
        //      The only function that needed modification was the rederGraph function


 */

;(function( _rr, $, _, window, document, undefined){

    "use strict";

    /*************************
     set all defaults for the widget
     **************************/
    var widgetName = "seriesGraph";//name of widget set here


    //this.options will extend off defaults
    var defaults = {

        // Flag to show legend header
        bShowLegendTitle: true,

        // Flag to show legend on right otherwise on left
        bLegendOnRight: true, //otherwise on left

        // Flag to determine if we want to offset the position of the tooltip so that it doesn't block the data it's describing
        bOffsetTooltip: true,

        // Chart Types
        sDefaultType: "bars",
        oType: {},

        // Pixel Height of each bar
        nBarWidth: 25,

        // Dimensions of the chart relative to it's parent
        nChartWidth: null,
        nChartHeight: 100,
        nChartTop: null,
        nChartLeft: null,

        nGraphWidth: "100%",
        nGraphHeight: 140,

        // The Angle of the Label along the bottom of the chart
        nTextAngle: null,

        // A function used to determine where the tooltip should be placed
        setTooltipPosition: null,

        // Mouse Over Callback
        onMouseOver: null

    };




    /*************************
     The actual widget constructor
     **************************/
    function Widget ( options ) {

        this.graphHelper = _rr.graphHelper(this);

        _.defaults(defaults, this.graphHelper._defaults);
        this.options = $.extend( {}, defaults, options );

        this._defaults = defaults;
        this._name = widgetName;

        this._init();

    }//end widget constructor




    /********************************************************
     Set all of our methods in the widget's prototype - so they will only be initiated once for all instances of this widget
     - "_init" method is the entry point
     *************************************************************/
    Widget.prototype = {

        // Entry point for this entire widget
        _init: function(){

            var
                _this = this,
                options = this.options,
                graphHelper = this.graphHelper,

                google = window.google,
                bPercentageWidth = (typeof options.nGraphWidth === "string" && options.nGraphWidth.slice(-1)[0] === "%");

            // Add a Temporary Loading Icon til the graph is ready
            this.imageLoader = document.createElement("img");
            options.element.appendChild(this.imageLoader);
            this.imageLoader.src = "images/spinner.gif";

            this._setGoogleOptions(options);

            // Load the Visualization API and the corechart package - calling callback set above
            google.load('visualization', '1', {'packages':['corechart'], 'callback': function(){

                graphHelper.setFormatter( google );
                _this._setGraphData(options, google);
                _this._setupDOM(options, google);
                _this._renderGraph(options, google);

                if(bPercentageWidth && options.bResponsive)
                {
                    var
                        nOldTime = 0,
                        nNewTime = 0,
                        oldResize = window.onresize || function(){},
                        nWidthPercent = parseFloat(options.nGraphWidth) / 100,

                        imageLoader = _this.imageLoader.cloneNode(),
                        domOverflow = document.createElement("div"),
                        domReload = document.createElement("div");

                    domOverflow.className = "overflow";
                    domReload.className = "reload hide";

                    imageLoader.style.display = "inline-block";
                    imageLoader.className = "loader";

                    domReload.appendChild(imageLoader);

                    // domOverflow.appendChild(domReload);
                    domOverflow.appendChild(_this.divSVG);

                    _this.divSVG.childNodes[0].appendChild(domReload);
                    options.element.appendChild(domOverflow);

                    window.onresize = function(){
                        nOldTime = new Date().getTime();

                        if(_rr.dom.hasClass(domReload, "hide"))
                        {
                            _rr.dom.removeClass(domReload, "hide");
                        }

                        setTimeout(function(){
                            nNewTime = new Date().getTime();

                            if(nNewTime - nOldTime >= 1000)
                            {
                                _this.chart.draw(
                                    _this.googleData,
                                    _.defaults({
                                        animation: {
                                            duration: 0
                                        },
                                        width: options.element.getBoundingClientRect().width * nWidthPercent
                                    }, _this.googleOptions)
                                );
                                _rr.dom.addClass(domReload, "hide");
                            }
                        }, 1000);
                        oldResize();
                    };
                }

            }//end callback

            });



        },//end _init

        // [PUBLIC METHODS]

        /**
         * Shifts the Graph to include the new rows.
         *
         * @param {Boolean} bShiftRight: Flag to determine if the graph should shift to the right
         * @param {Array} aRowsAdded: An Array of Rows to be added to the graph
         */
        shiftGraph: function(bShiftRight, aRowsAdded){
            var
                options = this.options,
                google = window.google,
                googleOptions = this.googleOptions,
                googleData = this.googleData,

                aRows = options.aRows,
                aColumns = options.aColumns,
                nDuration = options.nDuration,
                bFormatTicks = options.bFormatTicks,

                nRows = aRows.length,
                nRowsAdded = aRowsAdded.length,
                nDirection = nRowsAdded * (bShiftRight ? 1 : -1),
                nOffsetLeft = nRows,
                nOffsetRight = nRows,
                aRowsCombined = [],
                aRowsFinal = [];

            // Get Combined Rows
            if(bShiftRight)
            {
                aRowsCombined = aRows.concat(aRowsAdded);
                nOffsetLeft -= nRowsAdded;
                aRowsFinal = aRowsCombined.slice(aRowsCombined.length - aRows.length);
            }
            else
            {
                aRowsCombined = aRowsAdded.concat(aRows);
                nOffsetRight -= nRowsAdded;
                aRowsFinal = aRowsCombined.slice(0, nRows);
            }

            // Shift the view port to match the current view
            googleOptions.hAxis.viewWindow.min -= nDirection;
            googleOptions.hAxis.viewWindow.max -= nDirection;

            // Setup the Graph
            options.aRows = aRowsCombined;
            this._setGraphData(options, google, {
                nLeft: nOffsetLeft,
                nRight: nOffsetRight
            });

            // Show the Image Loader
            this.imageLoader.style.display = "block";

            // Render the Graph - (This will reset the graph with the new data, before the animation occurs)
            googleOptions.animation.duration = 0;
            options.bFormatTicks = false;
            this._renderGraph(options, google);

            // Shift the view port back into place (This will give us our desired "sliding" animation)
            googleOptions.hAxis.viewWindow.min += nDirection;
            googleOptions.hAxis.viewWindow.max += nDirection;

            // Render the Graph Again with animation enabled
            googleOptions.animation.duration = nDuration;
            options.bFormatTicks = bFormatTicks;
            this._renderGraph(options, google);

            // Set aRows to the new Rows
            options.aRows = aRowsFinal;
        },

        // [PRIVATE METHODS]

        /*************************************
         sets "this.googleOptions" - options object to be passed to google lineGraph libarary
         **************************************/
        _setGoogleOptions: function( options ){

            var
                nRows = options.aRows.length,

                nBarWidth = options.nBarWidth,

            // Over written google options
                googleOptions = {

                    seriesType: options.sDefaultType,
                    series: options.oType,

                    bar: {
                        groupWidth: nBarWidth
                    },

                    hAxis: {
                        textPosition: 'out',
                        viewWindow: {
                            min: nRows,
                            max: nRows * 2
                        }
                    }
                };

            if(options.nTextAngle)
            {
                googleOptions.hAxis.slantedText = true;
                googleOptions.hAxis.slantedTextAngle = options.nTextAngle;
            }

            //set to "this" scope
            this.googleOptions = this.graphHelper.setGoogleOptions(options, googleOptions);
        },


        /**
         * Prepares data to go in graph
         *
         * @param {Object} options: Options passed in from the caller used to control how the DOM is setup
         * @param {Object} google: A reference to the google charts api
         * @param {Object} oOffset: An optional parameter that determines the offset of the graph's viewPort
         */
        _setGraphData: function( options, google, oOffset ){

            var
            // Functional Reference
                mapToArray = this.graphHelper.mapToArray,

            // Create google data object
                sTotalFormat,
                aColumnKeys = [],
                googleData = new google.visualization.DataTable(),
                bTotalAnnotation = options.bTotalAnnotation,

                aColumns = options.aColumns,
                nColumns = aColumns.length,

                aRows = options.aRows,
                nRows = aRows.length,

                nOffsetLeft = (oOffset ? oOffset.nLeft : nRows),
                nOffsetRight = (oOffset ? oOffset.nRight : nRows);

            //set columns
            for ( var i = 0; i < nColumns; i++ )
            {
                var
                    oColumn = aColumns[i],
                    sType = (_.contains(["integer", "decimal", "decimalSingle"], oColumn.format) ? "number" : oColumn.format),
                    sKey = oColumn.key,
                    sFormat = oColumn.format;

                googleData.addColumn({
                    type: sType,
                    label: oColumn.label,
                    id: sKey,
                    format: sFormat
                });

                if(bTotalAnnotation && i > 0)
                {
                    googleData.addColumn({
                        role: "annotation",
                        type: "string"
                    });
                    sTotalFormat = sFormat;
                }

                oColumn.type = sType;
                aColumnKeys.push(sKey);

                if(i === 0 && options.bCustomTooltips)
                {
                    googleData.addColumn({
                        role: "tooltip",
                        type: "string",
                        p: {
                            html: true
                        }
                    });
                }

                if (sType === "number" )
                {
                    this.oFormatter[sFormat].format(googleData, i);
                }
            }

            /* [LOOK AT ME LATER] */
            //if custom tooltips set to true, it loops through aRows to replace array with html for tooltips
            if ( options.bCustomTooltips )
            {
                this.graphHelper.setTooltips(aRows, aColumns);(aRows, aColumns);
            }

            // Add Blank Rows to the top and bottom of the cell so we can set them up for the sliding
            // animation
            googleData.addRows(nOffsetLeft);
            googleData.addRows(mapToArray(aRows, aColumnKeys, sTotalFormat, this));
            googleData.addRows(nOffsetRight);

            this.googleData = googleData;


        },//end function

        /**
         * Setup the DOM Structure for the graph object
         *
         * @param {Object} options: Options passed in from the caller used to control how the DOM is setup
         * @param {Object} google: A reference to the google charts api
         */
        _setupDOM: function(options, google){
            // Set up the DOM Structure
            var
                bShowLegend = options.bShowLegend,

                element = options.element,
                divSVG = document.createElement("div"),
                divLegend = document.createElement("div");

            divSVG.className = "noPrint svgGraph";

            if(options.bLegendOnRight){
                divLegend.className = "legend";
            }else{
                divLegend.className = "legend left";
            }




            if(bShowLegend)
            {
                element.appendChild(divLegend);
            }

            element.appendChild(divSVG);
            element.className += " graph clearfix";

            // Build the SVG Bar Graph
            this.chart = new google.visualization.ComboChart( divSVG );//init google's line chart object

            // Build the Legend
            if(bShowLegend)
            {
                this.createLegend_(divLegend, divSVG, options);
            }

            // Offset the tooptip's position
            if(options.bOffsetTooltip)
            {
                // If no position setting function was passed into the options, we use our own default
                if(typeof options.setTooltipPosition !== "function")
                {
                    options.setTooltipPosition = this.setDefaultTooltipPosition_;
                }

                this.graphHelper.setCustomTooltipPosition(divSVG, this.chart, options);
            }

            this.divLegend = divLegend;
            this.divSVG = divSVG;
        },

        /**
         * Render the Graph
         *
         * @param {Object} options: Options passed in from the caller used to control how the DOM is setup
         * @param {Object} google: A reference to the google charts api
         *
         * Updated by James Lester
         * Takes the parsed data extracts the critical parts out of the standard implemented method, groups it into the catagories nessisary to inject in to the highcharts api, then creates the high chart graph, modifiys any variables and redraws the chart
         *
         */
        _renderGraph: function( options, google ){

            // Format the ticks so the graph's view port take up an optimal amount of space
            if(options.bFormatTicks)
            {
                this.setViewPort_();
            }

            //JRL - developer purpose to view the incoming data so I know what is going on
            //console.log(this.googleData);


            //JRL - initalizes the first array of data points to be extracted from the googledata
            var arrDataPoints =[];

            //JRL - initalizes the standard interval for the while methods
            var i =0;

            //JRL - extracts the data from the Lf table in google data to be sorted
            while(this.googleData.Lf.length>i){

                //gareentees that the data is real and available
                if(this.googleData.Lf[i].c[0].v != undefined) arrDataPoints.push(this.googleData.Lf[i].c);
                i = i +1;

            }


///////////////////JRL - Testing purposes to check the data
//            console.log(" ");
//            console.log("arrdatapoints");
//
//            console.log(arrDataPoints);
/////////////////////////////////////////////////


            ///////////////JRL - initalizes the arrays that would normally be in a 3d array but I was feeling dispondedent about how the data was arraged in the first place and just wanted to finish the task
            var a = 0;
            var arrData1 = [];
            var arrData2 = [];
            var arrData3 = [];
            var arrData4 = [];
            var arrData5 = [];
            var arrData6 = [];


            //JRL - extracts the data for the data points to be injected in high charts, this is the number data;
            while(arrDataPoints.length> a){


                arrData1.push(arrDataPoints[a][0].v);


                arrData2.push(arrDataPoints[a][1].v);


                arrData3.push(arrDataPoints[a][2].v);


                arrData4.push(arrDataPoints[a][3].v);
                arrData5.push(arrDataPoints[a][4].v);
                arrData6.push(arrDataPoints[a][5].v);
                a = a+1;
            }

            ///JRL - creating some more arrays for extracting the catagories and individual data of the data points
            var arrString =[];

            i =0;

            var arrData = [];
            var arrCats = [];
            a =2;

            //JRL - putting the data extracted into the formate highcharts whats it arranged per label
            arrData.push(arrData1);
            arrData.push(arrData2);
            arrData.push(arrData3);
            arrData.push(arrData4);
            arrData.push(arrData5);
            arrData.push(arrData6);

            i= 0;

            //JRL - extracting the catagories out of the parsed data
            while(arrDataPoints.length> i){
                arrCats.push(arrDataPoints[i][0].v)
                i += 1;
            }


            i = 2;

            //JRL - inputing the data for the serial array to be injected into highcharts
            while(this.googleData.If.length>i){

                //JRL - check that data to make sure it works
                //console.log("arrData-------")
                //console.log(arrData[i]);

                if(i == 2){
                    //JRL - creates the line graph for the total values
                    if(this.googleData.If[i].label != undefined) arrString.push({type: 'line',name: this.googleData.If[i].label,data:arrData[i]});
                }else{
                    //JRL - creates the column values for the serial array
                    if(this.googleData.If[i].label != undefined) arrString.push({type: 'column',name: this.googleData.If[i].label,data:arrData[i]});
                }
                i = i +1;
            }


            //JRL - creates the graph, the beautiful graph
            var chart3 = new Highcharts.Chart({

                chart: {
                    renderTo: 'container',
                    shadow: 'true',
                    type: 'column',
                    height: 300,
                    width: 500
                },
                title: {
                    text: 'Master Graph'
                },
                xAxis: {
                    categories: arrCats
                },
                yAxis: {
                    title: {
                        text: ''
                    }
                },
                series: arrString
            });

            i = 0;


            //JRL - reinjects the correct names into the serial array for the chart
            while(arrString> i){
                chart3.series[i].name = arrString[i];
                i += 1;
            }

            //JRL - redraws the array and boom goes the dynamite.
            chart3.redraw();

            //this.chart.draw( this.googleData, this.googleOptions );//.draw is the method that actually draws the line graph

            // Mouse Over Callback
            if(options.onMouseOver)
            {
                google.visualization.events.addListener(this.chart, "onmouseover", options.onMouseOver);
            }

            // Hide the Image Loader
            this.imageLoader.style.display = "none";

            // Fire the Render Callback
            options.renderCallback(this);

        },//end function

        /**
         * Create the Customized Legend
         *
         * @param {DOM} divLegend: The DOM element that contains the Legend
         * @param {DOM} divSVG: The DOM element that contains the SVG Graph
         * @param {Object} options: The object used to control how the legend is created
         */
        createLegend_: function(divLegend, divSVG, options){
            var
                _this = this,

                aColumns = options.aColumns,
                aColors = this.googleOptions.colors,
                nColumns = options.nLegendColumns,

                domTitle = document.createElement("h3"),
                domContent = document.createElement("div"),
                tableLegend = document.createElement("table");

            domTitle.innerHTML = "Legend";
            domContent.className = "content";
            tableLegend.className = "width_100";

            // We start at the first column because it is always the label column and doesn't need to
            // be in our legend
            var
                nColumnCount = 0,
                tr = document.createElement("tr");

            tableLegend.appendChild(tr);
            for(var i = 1, size = aColumns.length; i < size; i++)
            {
                var
                    oColumn = aColumns[i],
                    bShow = !oColumn.bHideFromLegend,
                    sColor = aColors[i - 1],

                    td = document.createElement("td");

                if(bShow)
                {
                    td.innerHTML = "<span class='colorBlock' style='background-color: " + sColor + ";'></span> " + oColumn.label;
                    td.style.width = (100 / nColumns) + "%";

                    tr.appendChild(td);
                }

                nColumnCount++;
                if(nColumnCount === nColumns && i + 1 < size)
                {
                    nColumnCount = 0;
                    tr = document.createElement("tr");
                    tableLegend.appendChild(tr);
                }
            }

            domContent.appendChild(tableLegend);

            if(options.bShowLegendTitle){
                divLegend.appendChild(domTitle);
            }

            divLegend.appendChild(domContent);

            if(options.bStickyLegend)
            {
                this.graphHelper.setStickyLegend(divLegend, divSVG);
            }
        },


        /**
         * Set the View Port basee on the visibility of the data points pulled from aRows
         */
        setViewPort_: function(){
            var
                options = this.options,
                googleOptions = this.googleOptions,

                aRows = options.aRows,
                aColumns = options.aColumns,

                nMin = 0,
                nMax = 0;

            // Find the min and max values of all numeric fields
            for(var i = 0, size = aRows.length; i < size; i++)
            {
                var oRow = aRows[i];

                for(var j = 0, jsize = aColumns.length; j < jsize; j++)
                {
                    var
                        sKey = aColumns[j].key,
                        value = oRow[sKey];

                    if(typeof value === "number")
                    {
                        if(value < nMin)
                        {
                            nMin = value;
                        }
                        else if(value > nMax)
                        {
                            nMax = value;
                        }
                    }
                }
            }

            // Find the logarithmic scale for the min and max
            var
                nLog, nLogScale, nTickDistance, nMultiplier,
                nAbsMax = Math.abs(nMax),
                nAbsMin = Math.abs(nMin),
                nTickCount = options.nTickCount,
                nTickOffset = nTickCount >> 1,
                nDiffMultiplier = oMath.divide(nAbsMax , nAbsMin);

            if(nDiffMultiplier > 1)
            {
                nDiffMultiplier = 1 / nDiffMultiplier;
            }

            // We need to run this AT LEAST once before continuing or our calculation will get thrown off
            do
            {
                nTickOffset--;
            } while(nTickOffset / (nTickCount - nTickOffset) >= nDiffMultiplier)
            nTickOffset++;

            // Find the distance between each tick
            nTickDistance = Math.max(nAbsMax, nAbsMin) / (nTickCount - nTickOffset);
            if(nTickDistance === 0)
            {
                nTickDistance = 1;
            }

            nLog = Math.log(nTickDistance) * Math.LOG10E >> 0;
            nLogScale = (nLog + 1) / 3 >> 0;
            nMultiplier = Math.pow(10, nLog) / (nTickOffset % 2 === 0 ? 2 : 1);
            nTickDistance = Math.ceil(nTickDistance / nMultiplier) * nMultiplier;

            // Get the min and max values for the graph using the tick distance
            if(nAbsMax > nAbsMin)
            {
                nMin = nTickDistance * nTickOffset * -1;
                nMax = nTickDistance * (nTickCount - nTickOffset);
            }
            else
            {
                nMin = nTickDistance * (nTickCount - nTickOffset)  * -1;
                nMax =  nTickDistance * nTickOffset;
            }

            var nLogCheck = Math.pow(10, nLogScale * 3);
            if(nMax < nLogCheck && nMin * -1 < nLogCheck)
            {
                nLogScale--;
            }

            if(nLogScale < 0)
            {
                nLogScale = 0;
            }

            // Format the ticks
            var aTicks = [];
            for(var nValue = nMin; nValue <= nMax; nValue += nTickDistance)
            {
                aTicks.push({
                    v: nValue,
                    f: (nValue / Math.pow(10, (3 * nLogScale))) + " " + options.aScaleLocale[nLogScale]
                });
            }

            googleOptions.vAxis.ticks = aTicks;
        },

        /**
         * Get the Vertical position of a dom element
         *
         * @param {DOM} dom: The DOM element
         */
        getYPosition_: function(dom){
            var nTop = 0;

            if (dom.offsetParent)
            {
                do
                {
                    nTop += dom.offsetTop;
                }
                while (dom = dom.offsetParent);
            }

            return nTop;
        },

        /**
         * Maps the the values into an array that google charts understands
         *
         * @param {Object} aValues: Array Objects containing all the values
         * @param {Object} aKeys: List of keys comprising the value object
         * @param {Object} sTotalFormat: The total format used (if set to null, no totals is displayed)
         * @param {Object} _this: Reference to the bar graph object
         */
        mapToArray_: function(aValues, aKeys, sTotalFormat, _this){
            var
                bCustomTooltips = _this.options.bCustomTooltips,
                nSkipColumns = (bCustomTooltips ? 2 : 1),
                newArray = [];

            for(var i = 0, size = aValues.length; i < size; i++)
            {
                var
                    nAnnotationLocation = 0,
                    nTotal = 0,
                    subArray = [],
                    oValue = aValues[i];

                // We are adding the columns in reverse order so that we can determine if the annotation
                // will fit into the bar graph
                for(var j = aKeys.length - 1; j >= 0; j--)
                {
                    var nValue = oValue[aKeys[j]];

                    if(sTotalFormat && j > 0)
                    {
                        subArray.unshift(null);
                        if(nAnnotationLocation === 0 && nValue !== 0)
                        {
                            nAnnotationLocation = j * 2;
                        }

                        nTotal += nValue;
                    }
                    subArray.unshift(nValue);
                }

                if(nAnnotationLocation !== 0)
                {
                    subArray[nAnnotationLocation] = _rr.format.number(nTotal, sTotalFormat);
                }

                if(bCustomTooltips)
                {
                    subArray.splice(1, 0, oValue.tooltip);
                }

                newArray.push(subArray);
            }

            return newArray;
        },

        /**
         * Attemps to apply a customized offset for the graph (works on all major browsers expect IE8 and below)
         *
         * @param {DOM} divSVG: The DOM element containing the svg graph
         * @param {Object} oChart: The google representation of the graph
         * @param {Object} options: The options passed into the graph
         */
        setCustomTooltipPosition_: function(divSVG, oChart, options){
            var oCLI = oChart.getChartLayoutInterface();

            google.visualization.events.addOneTimeListener(oChart, 'ready', function () {
                var domContainer = divSVG.lastChild;
                function setPosition () {
                    var
                        domTooltip = $('.google-visualization-tooltip')[0],
                        oPosition = options.setTooltipPosition(domTooltip, oCLI);

                    if(domTooltip)
                    {
                        if("top" in oPosition)
                        {
                            domTooltip.style.top = oPosition.top;
                        }
                        if("left" in oPosition)
                        {
                            domTooltip.style.left = oPosition.left;
                        }
                    }
                }
                if (typeof MutationObserver === 'function') {
                    var observer = new MutationObserver(function (m) {
                        for (var i = 0; i < m.length; i++) {
                            if (m[i].addedNodes.length) {
                                setPosition();
                                break; // once we find the added node, we shouldn't need to look any further
                            }
                        }
                    });
                    observer.observe(domContainer, {
                        childList: true
                    });
                }
                else if (document.addEventListener) {
                    domContainer.addEventListener('DOMNodeInserted', setPosition);
                }
                else {
                    domContainer.attachEvent('onDOMNodeInserted', setPosition);
                }
            });
        },

        /**
         * The default position for tooltips (this will over ride google's default position)
         *
         * @param {DOM} domTooltip: The DOM element containing the tooltip
         * @param {Object} oCLI: The chart layout interface used by google (useful for extracting positional data)
         */
        setDefaultTooltipPosition_: function(domTooltip, oCLI){
            var oDimensions = oCLI.getChartAreaBoundingBox();
            return {
                top: (oDimensions.height + oDimensions.top) + "px"
            };
        }


    };//end Widget.prototype definition


    /**************************
     Wrapper around the constructor
     ******************************/
    window._rr[widgetName] = function ( options ) {

        return new Widget( options );


    };

})( window._rr, window.jQuery, _, window, document );//end main closure for file
