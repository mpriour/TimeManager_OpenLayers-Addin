/* Copyright (c) 2006-2011 by OpenLayers Contributors (see authors.txt for 
 * full list of contributors). Published under the Clear BSD license.  
 * See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */


/**
 * @requires OpenLayers/TimeAgent.js
 */

/**
 * Class: OpenLayers.TimeAgent.WMS
 * Class to display and animate WMS layers across time.
 * This class is created by {OpenLayers.Control.TimeManager} instances
 *
 * Inherits From:
 *  - <OpenLayers.TimeAgent>
 */
OpenLayers.TimeAgent.WMS = OpenLayers.Class(OpenLayers.TimeAgent,{
    /**
	 * APIProperty: intervalMode
	 * {String} If a wms layer has distinct valid time intervals,
	 *     then this property will control if and how the animation time is
	 *     translated into a valid time instance for the layer
	 *     Must be one of:
	 *     "lastValid" - continue to display it using the last valid time within
	 *         the overall control time range
     *     "nearest" - (Default) use the nearest valid time within the overall
     *         control time range.
     *     "exact" - only display the layer when there's an exact match (to the 
     *         grainularity of the step unit) in the control time and an interval
	 */
	intervalMode:'nearest',

    /**
     * APIProperty: rangeMode
     * {String} This property will control if and how the animation time is
     *     translated into a time range to display on each tick
     *     Must be one of:
     *      false - set to false to only use single value time parameters (Default)
     *      "range" - use a value range for time
     *      "cumulative" - use a range from the start time to the current time
     */    
    rangeMode:false,
    
    /**
     * APIProperty: rangeInterval
     * {Number} Number of units to add or subtract of the current time to build
     *      a time range to display with each tick. 
     *      ONLY used if intervalMode is 'range'
     */
    rangeInterval:null,
	
	/**
     * Constructor: OpenLayers.Control.TimeManager.WMS
     * Create a new time manager control for temporal WMS layers.
     *
     * Parameters:
     * options - {Object} Optional object whose properties will be set on the
     *     control.
     */
	initialize:function(options){
		OpenLayers.TimeAgent.prototype.initialize.call(this,options);
        //add layer loadend listeners
        if (this.layers) {
            for (var i = 0, len = this.layers.length; i < len; i++) {
                this.layers[i].events.on({
                    'loadend': this.onLayerLoadEnd,
                    'loadstart': this.onLayerLoadStart,
                    scope: this
                })
            }
        }
	},
	
    addLayer:function(layer){
        OpenLayers.TimeAgent.prototype.addLayer.call(this,layer);
        layer.events.on({
            'loadend': this.onLayerLoadEnd,
            'loadstart': this.onLayerLoadStart,
            scope: this
        })
    },
    removeLayer:function(layer){
        OpenLayers.TimeAgent.prototype.removeLayer.call(this,layer);
        layer.events.un({
            'loadend': this.onLayerLoadEnd,
            'loadstart': this.onLayerLoadStart,
            scope: this
        })
    },
    destroy:function(){
        for (var i = 0, len = this.layers.length; i < len; i++) {
            this.layers[i].events.un({
                'loadend': this.onLayerLoadEnd,
                'loadstart': this.onLayerLoadStart,
                scope: this
            })
        }
        OpenLayers.TimeAgent.prototype.destroy.call(this);
    },
    
	onTick:function(evt){
		this.currentTime = evt.currentTime || this.timeManager.currentTime;
        console.debug('CurrentTime:'+this.currentTime.toString());
		var inrange = this.currentTime <= this.range[1] && this.currentTime >= this.range[0];
        if (inrange) {
            this.loadQueue = OpenLayers.Array.filter(this.layers, function(lyr){return lyr.visibility}).length;
            this.canTick = !this.loadQueue;
            console.debug('canTick:FALSE\nQueueCount:' + this.loadQueue)
        }
        for (var i = 0, len = this.layers.length; i < len; i++) {
            if (inrange) {
                this.applyTime(this.layers[i], this.currentTime);
            }
            else {
                this.layers[i].setVisibility(false);
            }
        }
	},
	
	applyTime:function(layer,time){
		var isotime,minTime;
        if(this.rangeMode && layer.metadata.allowRange!==false){
            if(this.rangeMode=='range'){
                minTime = new Date(time.getTime())
                minTime['setUTC'+this.timeManager.units](time['getUTC'+this.timeManager.units]()+this.rangeInterval);
            }else{
                minTime = this.range[0]
            }
            isotime=OpenLayers.Date.toISOString(minTime)+'/'+OpenLayers.Date.toISOString(time)
        }
        else if (layer.metadata.timeInterval[0] instanceof Date && this.intervalMode != "exact") {
            //find where this time fits into
            var intervals = layer.metadata.timeInterval;
            var testResults = this.findNearestTimes(time, intervals);
            var wmstime;
            if (testResults.exact !== false) {
                wmstime = intervals[testResults.exact];
            }
            else if (this.intervalMode == "lastValid") {
                wmstime = intervals[testResults.before]
            }
            else {
                wmstime = time - intervals[testResults.before] > time - intervals[testResults.after] ? intervals[testResults.after] : intervals[testResults.before];
            }
            isotime = OpenLayers.Date.toISOString(wmstime);
        }
        else {
            //format time in ISO:8601 format
            isotime = OpenLayers.Date.toISOString(time);
        }
        layer.mergeNewParams({time:isotime});
	},
    /**
     * 
     * @param {Object} testDate
     * @param {Array[{Date}]} dates - MUST be a sorted date array
     */
	findNearestTimes: function(testDate,dates){
        var retObj = {exact:false,before:-1,after:-1}
        //first check that this time is in the array
        for (var i = 0, len = dates.length; i < len; i++) {
            if (testDate.getTime() == dates[i].getTime()) {
                retObj.exact = i;
                break;
            }
            else {
                var diff = testDate - dates[i];
                if (diff < 0) {
                    retObj.after = i;
                    if (retObj.before == -1) {
                        retObj.before = 0
                    }
                    break;
                }
                else {
                    retObj.before = i;
                }
            }
        }
        return retObj;
    },
    onLayerLoadEnd: function(){
        this.loadQueue--;
        console.debug('QueueCount:'+this.loadQueue)
        if (this.loadQueue <= 0) {this.canTick = true; console.debug('canTick:TRUE')}
    },
    onLayerLoadStart: function(){
        //this.loadQueue=(!this.loadQueue && this.loadQueue!==0)?0:this.loadQueue++
    },
	CLASS_NAME:'OpenLayers.TimeAgent.WMS'
});