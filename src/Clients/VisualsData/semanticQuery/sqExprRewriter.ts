﻿/*
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

module powerbi.data {
    import ArrayExtensions = jsCommon.ArrayExtensions;

    /** Rewrites an expression tree, including all descendant nodes. */
    export class SQExprRewriter implements ISQExprVisitor<SQExpr> {
        public visitColumnRef(expr: SQColumnRefExpr): SQExpr {
            let origArg = expr.source,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return expr;

            return new SQColumnRefExpr(rewrittenArg, expr.ref);
        }

        public visitMeasureRef(expr: SQMeasureRefExpr): SQExpr {
            let origArg = expr.source,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return expr;

            return new SQMeasureRefExpr(rewrittenArg, expr.ref);
        }

        public visitAggr(expr: SQAggregationExpr): SQExpr {
            let origArg = expr.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return expr;

            return new SQAggregationExpr(rewrittenArg, expr.func);
        }

        public visitHierarchy(expr: SQHierarchyExpr): SQExpr {
            let origArg = expr.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return expr;

            return new SQHierarchyExpr(rewrittenArg, expr.hierarchy);
        }

        public visitHierarchyLevel(expr: SQHierarchyLevelExpr): SQExpr {
            let origArg = expr.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return expr;

            return new SQHierarchyLevelExpr(rewrittenArg, expr.level);
        }

        public visitEntity(expr: SQEntityExpr): SQExpr {
            return expr;
        }

        public visitAnd(orig: SQAndExpr): SQExpr {
            let origLeft = orig.left,
                rewrittenLeft = origLeft.accept(this),
                origRight = orig.right,
                rewrittenRight = origRight.accept(this);

            if (origLeft === rewrittenLeft && origRight === rewrittenRight)
                return orig;

            return new SQAndExpr(rewrittenLeft, rewrittenRight);
        }

        public visitBetween(orig: SQBetweenExpr): SQExpr {
            let origArg = orig.arg,
                rewrittenArg = origArg.accept(this),
                origLower = orig.lower,
                rewrittenLower = origLower.accept(this),
                origUpper = orig.upper,
                rewrittenUpper = origUpper.accept(this);

            if (origArg === rewrittenArg && origLower === rewrittenLower && origUpper === rewrittenUpper)
                return orig;

            return new SQBetweenExpr(rewrittenArg, rewrittenLower, rewrittenUpper);
        }

        public visitIn(orig: SQInExpr): SQExpr {
            let origArgs = orig.args,
                rewrittenArgs = this.rewriteAll(origArgs),
                origValues: SQExpr[][] = orig.values,
                rewrittenValues: SQExpr[][];

            for (let i = 0, len = origValues.length; i < len; i++) {
                let origValueTuple = origValues[i],
                    rewrittenValueTuple = this.rewriteAll(origValueTuple);

                if (origValueTuple !== rewrittenValueTuple && !rewrittenValues)
                    rewrittenValues = ArrayExtensions.take(origValues, i);

                if (rewrittenValues)
                    rewrittenValues.push(rewrittenValueTuple);
            }

            if (origArgs === rewrittenArgs && !rewrittenValues)
                return orig;

            return new SQInExpr(rewrittenArgs, rewrittenValues || origValues);
        }

        private rewriteAll(origExprs: SQExpr[]): SQExpr[]{
            debug.assertValue(origExprs, 'origExprs');

            let rewrittenResult: SQExpr[];
            for (let i = 0, len = origExprs.length; i < len; i++) {
                let origExpr = origExprs[i],
                    rewrittenExpr = origExpr.accept(this);

                if (origExpr !== rewrittenExpr && !rewrittenResult)
                    rewrittenResult = ArrayExtensions.take(origExprs, i);

                if (rewrittenResult)
                    rewrittenResult.push(rewrittenExpr);
            }

            return rewrittenResult || origExprs;
        }

        public visitOr(orig: SQOrExpr): SQExpr {
            let origLeft = orig.left,
                rewrittenLeft = origLeft.accept(this),
                origRight = orig.right,
                rewrittenRight = origRight.accept(this);

            if (origLeft === rewrittenLeft && origRight === rewrittenRight)
                return orig;

            return new SQOrExpr(rewrittenLeft, rewrittenRight);
        }

        public visitCompare(orig: SQCompareExpr): SQExpr {
            let origLeft = orig.left,
                rewrittenLeft = origLeft.accept(this),
                origRight = orig.right,
                rewrittenRight = origRight.accept(this);

            if (origLeft === rewrittenLeft && origRight === rewrittenRight)
                return orig;

            return new SQCompareExpr(orig.kind, rewrittenLeft, rewrittenRight);
        }

        public visitContains(orig: SQContainsExpr): SQExpr {
            let origLeft = orig.left,
                rewrittenLeft = origLeft.accept(this),
                origRight = orig.right,
                rewrittenRight = origRight.accept(this);

            if (origLeft === rewrittenLeft && origRight === rewrittenRight)
                return orig;

            return new SQContainsExpr(rewrittenLeft, rewrittenRight);
        }

        public visitExists(orig: SQExistsExpr): SQExpr {
            let origArg = orig.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return orig;

            return new SQExistsExpr(rewrittenArg);
        }

        public visitNot(orig: SQNotExpr): SQExpr {
            let origArg = orig.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return orig;

            return new SQNotExpr(rewrittenArg);
        }

        public visitStartsWith(orig: SQStartsWithExpr): SQExpr {
            let origLeft = orig.left,
                rewrittenLeft = origLeft.accept(this),
                origRight = orig.right,
                rewrittenRight = origRight.accept(this);

            if (origLeft === rewrittenLeft && origRight === rewrittenRight)
                return orig;

            return new SQStartsWithExpr(rewrittenLeft, rewrittenRight);
        }

        public visitConstant(expr: SQConstantExpr): SQExpr {
            return expr;
        }

        public visitDateSpan(orig: SQDateSpanExpr): SQExpr {
            let origArg = orig.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return orig;

            return new SQDateSpanExpr(orig.unit, rewrittenArg);
        }

        public visitDateAdd(orig: SQDateAddExpr): SQExpr {
            let origArg = orig.arg,
                rewrittenArg = origArg.accept(this);

            if (origArg === rewrittenArg)
                return orig;

            return new SQDateAddExpr(orig.unit, orig.amount, rewrittenArg);
        }

        public visitNow(orig: SQNowExpr): SQExpr {
            return orig;
        }

        public visitDefaultValue(orig: SQDefaultValueExpr): SQExpr {
            return orig;
        }

        public visitAnyValue(orig: SQAnyValueExpr): SQExpr {
            return orig;
        }
    }
}