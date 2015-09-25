/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/// <reference path="../_references.ts"/>

module powerbi.visuals {

    export interface FisheyeData {
        categorySourceName: string;
        formatString: string;
        fisheyeDataPoints: FisheyeDataPoint[];
        fisheyeSettings: FisheyeSettings;
    }

    export interface FisheyeDataPoint extends SelectableDataPoint, SlicerDataPoint {
        value: string;
        mouseOver: boolean;
        mouseOut: boolean;
        isSelectAllDataPoint?: boolean;
        key:string;
        selector: data.Selector;
    }

    export interface FisheyeSettings extends SlicerSettings {
    }


    //Code adapted from the implementation by Jason Davies 
    //at https://github.com/d3/d3-plugins/tree/master/fisheye
    export class D3FisheyeDistortion{
        
        baseScale:D3.Scale.IdentityScale;
        baseDistortion:number;
        baseFocusNum:number;

        constructor(base:D3.Scale.IdentityScale, baseD:number, baseA:number){
            this.baseScale = base;
            this.baseDistortion = baseD;
            this.baseFocusNum = baseA;
        }

        distortion(value?:number):any{
            if(!value) return this.baseDistortion;
            this.baseDistortion=value;
            return this;
        }

        scale(_){
          var x = this.baseScale(_),
          left = x < this.baseFocusNum,
          v,
          range = d3.extent(this.baseScale.range()),
          min = range[0],
          max = range[1],
          m = left ? this.baseFocusNum - min : max - this.baseFocusNum;
          if (m == 0) m = max - min;
          return (left ? -1 : 1) * m * (this.baseDistortion + 1) / (this.baseDistortion + (m / Math.abs(x - this.baseFocusNum))) + this.baseFocusNum;
        }

        focus(value?:number):any{
            if(!value) return this.baseFocusNum;
            this.baseFocusNum=value;
            return this;
        }

        range(values?:any[]):any{
            var self = this.baseScale;
            this.baseScale.apply(self,values);
            return this;
        }
        
        domain(values?:any[]):any{
            var self = this.baseScale;
            this.baseScale.domain(values).apply(self,values);
            return this;
        }

        copy(){
            return this.baseScale;
        }
        
        invert(value: number): number{
            return this.baseScale.invert(value);
        }

        ticks(count: number): any[]{
            return this.baseScale.ticks(count);
        }

        tickFormat(count: number): (n: number) => string{
            return this.baseScale.tickFormat(count);
        }

    }

    export class FisheyeSelector implements IVisual  {
        private element: JQuery;
        private currentViewport: IViewport;
        private dataView: DataView;
        private fisheyeContainer: D3.Selection;
        private fisheyeHeader: D3.Selection;
        private fisheyeBody: D3.Selection;
        private settings: FisheyeSettings;
        private hostServices: IVisualHostServices;
        private static clearTextKey = 'Fisheye_Clear';
        private static selectAllTextKey = 'Fisheye_SelectAll';
        private waitingForData: boolean;
        private selectionManager:utility.SelectionManager;
        //comment line above and uncomment below to get this to compile locally. utility module was needed
        //to get the visual to work online
        //private selectionManager:SelectionManager;

        private d3Fisheye: D3FisheyeDistortion = new D3FisheyeDistortion(d3.scale.identity(),3,0)

        private static Container: ClassAndSelector = {
            class: 'fisheyeContainer',
            selector: '.fisheyeContainer'
        };
        private static Header: ClassAndSelector = {
            class: 'fisheyeHeader',
            selector: '.fisheyeHeader'
        };
        private static HeaderText: ClassAndSelector = {
            class: 'headerText',
            selector: '.headerText'
        };
        private static Body: ClassAndSelector = {
            class: 'fisheyeBody',
            selector: '.fisheyeBody'
        };
        private static ItemContainer: ClassAndSelector = {
            class: 'slicerItemContainer',
            selector: '.slicerItemContainer'
        };
        private static LabelText: ClassAndSelector = {
            class: 'slicerText',
            selector: '.slicerText'
        };
        private static Input: ClassAndSelector = {
            class: 'slicerCheckbox',
            selector: '.slicerCheckbox'
        };
        private static Clear: ClassAndSelector = {
            class: 'clear',
            selector: '.clear'
        };

        public static DefaultStyleProperties(): FisheyeSettings {
            return {
                general: {
                    outlineColor: '#000000',
                    outlineWeight: 2
                 },
            header: {
                height: 22,
                borderBottomWidth: 1,
                    show: true,
                    outline: "BottomOnly",
                    fontColor: '#000000',
                    background: '#ffffff',
            },
            headerText: {
                marginLeft: 8,
                    marginTop: 0
            },
            slicerText: {
                color: '#666666',
                hoverColor: '#212121',
                selectionColor: '#212121',
                marginLeft: 8,
                    outline: "None",
                    background: '#ffffff'
            },
            slicerItemContainer: {
                height: 24,
                // The margin is assigned in the less file. This is needed for the height calculations.
                marginTop: 5,
                marginLeft: 8
                }
        };
        }

        public static capabilities: VisualCapabilities = {
            dataRoles: [{
                name: 'Category',
                kind: VisualDataRoleKind.Grouping
            }],
            dataViewMappings: [{
                categorical: {
                    categories: {
                        for: { in: 'Category' },
                        dataReductionAlgorithm: { top: {} }
                    },
                    rowCount: { preferred: { min: 1 } }
                },
            }],
            objects: {
                general: {
                    displayName: data.createDisplayNameGetter('Visual_General'),
                    properties: {
                        fill: {
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Fill'
                        },
                        size: {
                            type: { numeric: true },
                            displayName: 'Size'
                        }
                    },
                }
            },
        };

        public static converter(dataView: DataView, localizedSelectAllText: string, interactivityService: IInteractivityService): FisheyeData {
            var fisheyeItemData: FisheyeData;
            if (!dataView) {
                return;
            }

            var dataViewCategorical = dataView.categorical;
            if (dataViewCategorical == null || dataViewCategorical.categories == null || dataViewCategorical.categories.length === 0)
                return;

            var isInvertedSelectionMode = false;
            var objects = dataView.metadata ? <any> dataView.metadata.objects : undefined;
            var categories = dataViewCategorical.categories[0];

            if (objects && objects.general && objects.general.filter) {
                var identityFields = categories.identityFields;
                if (!identityFields)
                    return;
                var filter = <powerbi.data.SemanticFilter>objects.general.filter;
                var scopeIds = powerbi.data.SQExprConverter.asScopeIdsContainer(filter, identityFields);
                isInvertedSelectionMode = scopeIds.isNot;
            }

            var categoryValuesLen = categories && categories.values ? categories.values.length : 0;
            var fisheyeDataPoints: FisheyeDataPoint[] = [];
                                     
            for (var idx = 0; idx < categoryValuesLen; idx++) {
                var categoryIdentity = categories.identity ? categories.identity[idx] : null;
                fisheyeDataPoints.push({
                    value: categories.values[idx],
                    mouseOver: false,
                    mouseOut: true,
                    identity: SelectionId.createWithId(categoryIdentity),
                    selected: false,
                    key:categoryIdentity.key,
                    selector: SelectionId.createWithId(categoryIdentity)
                });
            }

            var defaultSettings = this.DefaultStyleProperties();
            objects = dataView.metadata.objects;
            if (objects) {
                defaultSettings.general.outlineColor = DataViewObjects.getFillColor(objects, slicerProps.general.outlineColor, this.DefaultStyleProperties().general.outlineColor);
                defaultSettings.general.outlineWeight = DataViewObjects.getValue<number>(objects, slicerProps.general.outlineWeight, this.DefaultStyleProperties().general.outlineWeight);
                defaultSettings.header.show = DataViewObjects.getValue<boolean>(objects, slicerProps.header.show, this.DefaultStyleProperties().header.show);
                defaultSettings.header.fontColor = DataViewObjects.getFillColor(objects, slicerProps.header.fontColor, this.DefaultStyleProperties().header.fontColor);
                defaultSettings.header.background = DataViewObjects.getFillColor(objects, slicerProps.header.background, this.DefaultStyleProperties().header.background);
                defaultSettings.header.outline = DataViewObjects.getValue<string>(objects, slicerProps.header.outline, this.DefaultStyleProperties().header.outline);
                defaultSettings.slicerText.color = DataViewObjects.getFillColor(objects, slicerProps.Rows.fontColor, this.DefaultStyleProperties().slicerText.color);
                defaultSettings.slicerText.background = DataViewObjects.getFillColor(objects, slicerProps.Rows.background, this.DefaultStyleProperties().slicerText.background);
                defaultSettings.slicerText.outline = DataViewObjects.getValue<string>(objects, slicerProps.Rows.outline, this.DefaultStyleProperties().slicerText.outline);
            }
                
            fisheyeItemData = {
                categorySourceName: categories.source.displayName,
                formatString: valueFormatter.getFormatString(categories.source, slicerProps.formatString),
                fisheyeSettings: defaultSettings,
                fisheyeDataPoints: fisheyeDataPoints
            };

            return fisheyeItemData;
        }

        public init(options: VisualInitOptions): void {
            this.element = options.element;
            this.currentViewport = options.viewport;
            this.hostServices = options.host;
            this.settings = FisheyeSelector.DefaultStyleProperties();
            if(!this.hostServices) this.hostServices = new DefaultVisualHostServices(); 
            this.selectionManager = new utility.SelectionManager({ hostServices: this.hostServices });
            this.initContainer();
        }

        public update(options: VisualUpdateOptions): void {
            var dataViews = options.dataViews;
            this.currentViewport = options.viewport;
            debug.assertValue(dataViews, 'dataViews');
            var existingDataView = this.dataView;
            if (dataViews && dataViews.length > 0) {
                this.dataView = dataViews[0];
            }
            this.updateInternal(false);
        }



        private updateInternal(resetScrollbarPosition: boolean = false) {
            var localizedSelectAllText = FisheyeSelector.selectAllTextKey;
            var data = FisheyeSelector.converter(this.dataView, localizedSelectAllText, null);
            if (!data) {
                return;
            }

            var d3FisheyeLocal = this.d3Fisheye = 
                this.d3Fisheye
                .domain([20, this.currentViewport.height])


            this.fisheyeBody.attr("height", this.currentViewport.height)
            .attr("width", this.currentViewport.width)

            //remove all the dom nodes
            this.fisheyeBody
            .selectAll("*").remove();

            var groupNode = this.fisheyeBody.append("g");

            var ySteps:number[] = d3.range(1, this.currentViewport.height, this.currentViewport.height/data.fisheyeDataPoints.length);

            var textGroupData = this.fisheyeBody
            .selectAll(".categoryNode")
            .data(data.fisheyeDataPoints)
            .enter();

            var textGroup = textGroupData.append("text")
            .attr("class",".categoryNode")
            .attr("fill", "teal")
            .text(function(d:FisheyeDataPoint){return d.value})
            .attr("y", function(x,i){return d3FisheyeLocal.scale(ySteps[i])}).attr("dy", -10)
            .attr("font-size",10)

            this.fisheyeBody
                .on('click', () => this.selectionManager.clear().then(() => textGroup.style('opacity', 1)));
            
            
            this.fisheyeBody.on("mousemove", null);
            this.fisheyeBody.on("mousemove", function(){
                var mouse = d3.mouse(this);
                d3FisheyeLocal.focus(mouse[1]);

                textGroup
                .attr("y", function(x,i){return d3FisheyeLocal.scale(ySteps[i])})
                .attr("dy", -20)
                .attr("font-size",10)

                d3.select(textGroup.filter(function(d,i) {
                  return +d3.select(this).attr("y") > +mouse[1];
                }).node()).attr("font-size", 20);


            });

            var selectionManager = this.selectionManager;
            textGroup.on('click', function (d) {
                selectionManager.select(d.selector).then((ids) => {
                    if (ids.length > 0) {
                        textGroup.style('opacity', 0.5);
                        d3.select(this).style('opacity', 1);
                    } else {
                        textGroup.style('opacity', 1);
                    }
                });
                d3.event.stopPropagation();
            })

        }

        private initContainer() {
            var settings = this.settings;
            var fisheyeBodyViewport = this.getFisheyeBodyViewport(this.currentViewport);
            this.fisheyeContainer = d3.select(this.element.get(0)).classed(FisheyeSelector.Container.class, true);

            this.fisheyeHeader = this.fisheyeContainer.append("div").classed(FisheyeSelector.Header.class, true)
                .style('height', SVGUtil.convertToPixelString(settings.header.height));

            this.fisheyeHeader.append("span")
                .classed(FisheyeSelector.Clear.class, true)
                .attr('title', FisheyeSelector.clearTextKey);

            this.fisheyeHeader.append("div").classed(FisheyeSelector.HeaderText.class, true)
                .style({
                    'margin-left': SVGUtil.convertToPixelString(settings.headerText.marginLeft),
                    'margin-top': SVGUtil.convertToPixelString(settings.headerText.marginTop),
                    'border-style': this.getBorderStyle(settings.header.outline),
                    'border-color': settings.general.outlineColor,
                    'border-width': this.getBorderWidth(settings.header.outline,settings.general.outlineWeight)                 
                });

            this.fisheyeBody = this.fisheyeContainer.append("svg")
            .attr("height",fisheyeBodyViewport.height)
            .attr("width", fisheyeBodyViewport.width);
            this.fisheyeBody.append("g").classed(FisheyeSelector.Body.class, true);

        }

        private getFisheyeBodyViewport(currentViewport: IViewport): IViewport {
            var settings = this.settings;
            var headerHeight = (this.settings.header.show) ? settings.header.height : 0; 
            var fisheyeBodyHeight = currentViewport.height - (headerHeight + settings.header.borderBottomWidth);
            return {
                height: fisheyeBodyHeight,
                width: currentViewport.width
            };
        }

        private getRowHeight(): number {
            var slicerItemSettings = this.settings.slicerItemContainer;
            return slicerItemSettings.height;
        }

        private getBorderStyle(outlineElement: string): string {

            return outlineElement === '0px' ? 'none' : 'solid';
        }

        private getBorderWidth(outlineElement: string, outlineWeight: number): string {

            switch (outlineElement) {
                case 'None':
                    return "0px";
                case 'BottomOnly':
                    return "0px 0px " + outlineWeight +"px 0px";
                case 'TopOnly':
                    return  outlineWeight +"px 0px 0px 0px";
                case 'TopBottom':
                    return outlineWeight + "px 0px "+ outlineWeight +"px 0px";
                case 'LeftRight':
                    return "0px " + outlineWeight + "px 0px " + outlineWeight +"px";
                case 'Frame':
                    return outlineWeight +"px";
                default:    
                    return outlineElement.replace("2",outlineWeight.toString());

            }
        }

    }
}