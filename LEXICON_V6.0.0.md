TimSyS Lexicon v6.0.0

Status: FROZEN

This document defines the official vocabulary of the TimSyS platform. All architectural discussions, documentation, and code shall use these terms exactly as defined. Terms not in this Lexicon shall not be used in platform artifacts.
Architecture Terms
Module

The fundamental deployable unit of the TimSyS platform. A Module is a self-describing directory containing a Manifest, an entry point, handlers, schemas, and migrations. Modules declare their dependencies, capabilities, routes, and events. The platform discovers, validates, registers, and wires Modules automatically. No Module shall be wired through manual code edits.
Manifest

The declaration file (module.json) at the root of every Module. The Manifest specifies the Module's name, version, dependencies, capabilities, routes, functions, schema references, and event subscriptions. The Manifest is the sole source of truth for what a Module requires and provides. The platform reads Manifests during discovery. No Module is valid without a Manifest.
Service

A shared infrastructure interface exposed by the platform. Services define contracts for how behaviour is requested, not how it is implemented. All Services live in /shared/services/. Modules consume Services exclusively through the Context object injected during boot. No Module shall import a Service implementation directly. The platform provides exactly six Services: DB, Cache, Auth, Log, Validation, and EventBus.
Contract

The interface specification for a Service. A Contract defines method signatures, parameter types, and return types without implementation. Contracts are frozen before implementation begins. No Service implementation may deviate from its Contract. No Module may depend on Service behaviour not defined in its Contract.
Capability

A named unit of behaviour that a Module provides. Capabilities are declared in the Manifest under provides. Capabilities are registered in the CapabilityRegistry during staging. Modules may declare requires on Capabilities owned by other Modules. The dependency graph enforces that all required Capabilities are available before a Module boots.
Function

A callable procedure exported by a Module. Every Function is declared in the Manifest under functions with its name, parameters, and return type. Functions are registered in the FunctionRegistry during staging. Functions are the sole invocation target for routes and inter-module calls. No Function shall exist without a Manifest declaration. Functions follow the {module}_{operation} naming convention.
Infrastructure Terms
Registry

A platform-managed store that tracks registered entities. The platform maintains six Registries: ModuleRegistry, SchemaRegistry, RouteRegistry, FunctionRegistry, CapabilityRegistry, and DependencyGraph. Registries are populated during the staging pipeline and queried throughout the platform lifecycle. No Registry shall be modified outside the staging pipeline.
Pipeline

The automated staging mechanism that transforms a Module directory into a running, wired platform component. The Pipeline executes five sequential stages: Discover, Validate, Register, Wire, and Boot. The Pipeline is the sole mechanism for bringing a Module into the running platform. No Module enters the platform outside the Pipeline.
Staging

The act of running a Module through the Pipeline. When a Module is staged, the Pipeline discovers its Manifest, validates its declarations, registers it across all Registries, wires its routes and dependencies, and executes its boot hook. When a Module is unstaged, the Pipeline reverses this process in order. Staging may be triggered by directory scan at boot or by API call at runtime.
Context

The dependency object injected into a Module's boot(ctx) and teardown(ctx) functions. The Context provides access to all six Services and the Module's own registration metadata. The Context is the sole legal channel through which a Module accesses platform infrastructure. No Module shall import platform internals directly. The Context is constructed by the Wire stage of the Pipeline.
Migration

A versioned SQL file that creates or alters database schema. Migrations live in /modules/{moduleName}/migrations/. Migrations are numbered sequentially and applied in order during boot. Applied migrations are tracked in the schema_migrations table. No Migration shall be skipped. No Migration shall be modified after deployment. Backward compatibility is mandatory.
Schema

The structural definition of a Module's database tables. Schemas are declared through Migrations and registered in the SchemaRegistry during staging. The SchemaRegistry is the sole authority on what tables exist and who owns them. No Module shall query a table it does not own or declare as a dependency.
HTTP Layer Terms
Route

An HTTP endpoint declared in a Module's Manifest. Each Route specifies a path, HTTP method, handler reference, and authentication requirement. Routes are registered in the RouteRegistry during staging. The Wire stage connects Routes to their handler Functions. No Route shall be registered through manual code. Path conflicts are detected during validation and fail staging.
Handler

A Function designated in a Module's Manifest as the target for a Route. Handlers receive the HTTP request and Context, and return a standardised response envelope. Handlers must be declared in the Manifest's functions array. No undeclared Function shall serve as a Handler.
Middleware

A platform-level processing function in the HTTP request chain. Middleware executes before Handlers in a fixed order: CORS, body parsing, cookie parsing, CSRF protection, authentication, authorization, rate limiting, and request logging. Middleware is platform-owned. No Module shall define or modify Middleware. Middleware order is non-negotiable.
Lifecycle Terms
Boot

The platform initialization sequence executed once at startup. Boot loads contracts, initializes Services, runs migrations, discovers Modules, builds the dependency graph, computes boot order, stages all Modules, wires routes, executes Module boot hooks, and starts the HTTP server. Boot is atomic — any failure before HTTP server start aborts the entire sequence and rolls back.
Teardown

The graceful shutdown of a staged Module. Teardown executes the Module's teardown(ctx) hook, removes its routes from the RouteRegistry, unregisters its functions and capabilities, invalidates its cache entries, and marks it as unstaged in the ModuleRegistry. Teardown is the reverse of staging, executed in reverse dependency order.
Lifecycle

The sequence of states a Module passes through: Discovered → Validated → Registered → Wired → Booted → (Running) → Unstaging → Unstaged. The Pipeline governs transitions between these states. A Module in any pre-Booted state is not accessible to the platform. A Module in Unstaged state retains its files but has no runtime presence.
Runtime Terms
Event

A notification published through the EventBus. Events are declared in a Module's Manifest under publishes and subscribes. Events trigger reactions in subscribing Modules but do not own behaviour. The EventBus is the sole legal mechanism for inter-Module communication at runtime. No Module shall directly call another Module's internal code.
Dependency

A declared requirement that one Module has on another Module's Capability or on a platform Service. Dependencies are declared in the Manifest. The DependencyGraph tracks all Dependencies and enforces availability before boot. Circular Dependencies are detected during graph construction and fail staging immediately. No Module shall import or reference a Module it has not declared as a Dependency.
Application

A collection of Modules that together deliver end-user functionality. Applications consume platform Services through Context objects and express functionality through Routes and Functions. Applications never directly access platform internals. TimSyS itself is the platform. The school administration system is the first Application built on it.
Intelligence Terms
Introspection

The platform's ability to expose its own state through API endpoints. Introspection queries read from Registries and return structured knowledge about available Modules, Capabilities, Functions, Routes, and Dependencies. Introspection enables self-awareness and gap analysis.
Gap Analysis

The calculation of completion percentage for a Module by comparing declared requirements against available Capabilities and implemented Functions. Gap Analysis produces a score, identifies missing artifacts, and recommends actions to reach 100% completion.
Recommendation Engine

The system that analyzes available Capabilities, identifies orphan or partial Modules, and suggests viable Module builds based on user intent and platform readiness. Recommendations include estimated effort, dependency checks, and next-step instructions.
Builder

An Application that consumes Introspection, Gap Analysis, and Recommendation APIs to scaffold new Modules and guide developers through completion. The Builder generates scaffolding code and draft Manifests for human review. It does not modify platform internals directly.
Development Order

    Contract
    Service
    Registry
    Module
    Manifest
    Capability
    Function
    Migration
    Schema
    Pipeline
    Staging
    Context
    Route
    Handler
    Middleware
    Boot
    Teardown
    Lifecycle
    Event
    Dependency
    Application
    Introspection
    Gap Analysis
    Recommendation Engine
    Builder
