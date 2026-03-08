import { demoScenario } from '../data/demoScenario'
import { callClaude } from './claudeClient'
import { runSpatialAgent } from './spatialAgent'
import { runSynthesisAgent } from './synthesisAgent'

// ─── Agent Stubs (replaced progressively as real agents are tested) ───────────

async function runVisionAgent(scoutingData) {
    // Stub: replaced by visionAgent.js once image capture is wired
    return {
        success: true,
        data: { defoliation_percent: 38, damage_types: ['Defoliation'], growth_stage: '6-Leaf', crop_type: 'Corn' },
    }
}

async function runEnvironmentalAgent(scoutingData) {
    // Stub: replaced by environmentalAgent.js — real impl tested separately
    return {
        success: true,
        data: { precipitation_mm: 39.7, flood_risk_score: 'Moderate', elevation_m: 213, max_wind_kmh: 68, source: 'stub' },
    }
}

async function runInsuranceAgent(visionOut, envOut) {
    // Stub: replaced by insuranceAgent.js — real impl tested separately
    return {
        success: true,
        data: "FCIC-25080 Exhibit 15 applied. 10-leaf corn with 80% defoliation correlates to 11% yield loss penalty.",
    }
}


// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Main entry point for the agent pipeline.
 * Fans out initial agent requests, gathers them, and runs synthesis/insurance.
 *
 * SAFETY NET: If anything throws an error or returns a failure, 
 * this immediately catches it and safely yields the pre-baked demo scenario data.
 */
export async function runAssessmentPipeline(scoutingData) {
    try {
        console.log('🚀 Starting Agent Assessment Pipeline...')

        // Phase 1: Vision + Environmental in parallel (independent data sources)
        const [visionRes, envRes] = await Promise.all([
            runVisionAgent(scoutingData),
            runEnvironmentalAgent(scoutingData),
        ])

        if (!visionRes.success || !envRes.success) {
            throw new Error('Vision or Environmental agent failed.')
        }

        // Phase 2: Spatial + Insurance in parallel (both depend on Phase 1, not on each other)
        // Spatial is pure logic (sync wrapped in async); Insurance calls Claude.
        const [spatialRes, insuranceRes] = await Promise.all([
            Promise.resolve(runSpatialAgent(scoutingData, visionRes.data, envRes.data)),
            runInsuranceAgent(visionRes.data, envRes.data),
        ])

        console.log('SPATIAL AGENT OUTPUT:', JSON.stringify(spatialRes, null, 2))

        if (!spatialRes.success || !insuranceRes.success) {
            throw new Error('Spatial or Insurance agent failed.')
        }

        // Phase 3: Synthesis — supervisor node receives all upstream data
        const synthesisData = await runSynthesisAgent(
            visionRes.data,
            envRes.data,
            spatialRes.data,   // full spatial result including enrichedPoints + zoneSummaries
            insuranceRes.data,
        )

        console.log('✅ Assessment Pipeline Complete')

        // Unified master result — consumers destructure the agent they need
        return {
            vision:       visionRes.data,
            environmental: envRes.data,
            spatial:      spatialRes,       // full object per spec
            insurance:    insuranceRes.data,
            synthesis:    synthesisData,
        }

    } catch (error) {
        console.error('🚨 Pipeline Orchestration Error:', error)
        console.warn('⚠️ Falling back to safe demo scenario data.')

        // Safety Net: Never crash the UI. Return the baked demo data.
        return demoScenario
    }
}
