# System Design Document - Chronicle

## Overview

Chronicle is an AI-powered voice journaling application built with React Native (Expo Router) for the frontend and FastAPI (Python) for the backend. The system processes voice recordings, transcribes them using Whisper, generates AI reflections using Google Gemini, and delivers text-to-speech responses using HuggingFace TTS.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Expo App   │  │  React Native│  │  Mobile Apps │             │
│  │  (iOS/Android/Web)│  │  (Expo Router)│  │  (Future)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS + JWT
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API LAYER (FastAPI)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Auth Route │  │  Journal    │  │  AI Routes  │             │
│  │  (Register/  │  │  Service    │  │  (Transcribe│             │
│  │   Login/Me)  │  │             │  │   /TTS/Chat)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Auth Service│  │ Journal     │  │  AI Orchestrator│            │
│  │  (JWT)       │  │  Service    │  │  (ASR/Gemini) │            │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  ASR (Whisper)│  │  Reflection │  │  TTS (HuggingFace)│          │
│  │  (Speech→Text)│  │  (Text→Reflect)│  │  (Text→Audio)│          │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  MongoDB    │  │  Redis Cache│  │  Object Store│            │
│  │  (Primary)  │  │  (Session)  │  │  (Media)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend (React Native / Expo)
- **Framework**: Expo Router for navigation
- **State Management**: Context API for auth state
- **API Client**: Typed fetch client (`lib/api.ts`)
- **UI Components**: Bottom navigation, screens for dashboard, recording, reflection, chat, history

### 2. Backend (FastAPI)
- **Authentication**: JWT-based authentication with secure token storage
- **Journal Service**: Orchestrates the end-to-end flow (record → transcribe → reflect → save)
- **AI Services**:
  - **ASR**: HuggingFace Whisper for speech-to-text
  - **Reflection**: Google Gemini for insightful commentary
  - **TTS**: HuggingFace TTS for synthesized responses
- **Media Handling**: Local audio storage (backend/media/) for recordings

### 3. Database (MongoDB)
- **Collections**:
  - `users`: User profiles, authentication info
  - `journals`: Journal entries (transcript, mood, audio reference, AI reflection)
  - `messages`: Conversation history for each journal entry

## Scalability Analysis

### Current Limitations

| Area | Issue | Impact |
|------|-------|---------|
| **Single Server** | All components run on one Oracle Cloud instance | Bottleneck under load |
| **Storage** | Audio stored locally on server (backend/media/) | Not portable, potential loss on failure |
| **Concurrency** | No horizontal scaling for AI services | High CPU/Memory usage from Whisper/Gemini |
| **Database** | Single MongoDB instance | Limited throughput, no sharding |
| **Network** | Direct client-to-backend calls | No caching layer, higher latency |

### Scaling Strategy

#### Horizontal Scaling
1. **Stateless Services**: Move all services to be stateless (except databases)
2. **Containerization**: Dockerize each microservice
3. **Orchestration**: Kubernetes on Oracle Cloud (EKS or self-managed)
4. **Load Balancing**: Distribute traffic across multiple API instances

#### Database Optimization
1. **Sharding**: Partition journals by user ID or creation date
2. **Indexing**: Add indexes on `mood`, `created_at`, and `user_id` fields
3. **Read Replicas**: Offload frequent queries to replicas

#### AI Service Scaling
1. **Asynchronous Processing**: Queue recordings for async processing (Celery/RQ)
2. **Model Batching**: Process multiple recordings in batches
3. **GPU Acceleration**: Use GPU-enabled instances for Whisper/Gemini
4. **Caching**: Cache frequent reflections and TTS responses

## Reliability Improvements

### 1. Error Handling & Resilience
- **Circuit Breakers**: Prevent cascading failures when AI services are down
- **Retry Logic**: Exponential backoff for transient failures
- **Dead Letter Queues**: Handle failed job processing
- **Health Checks**: Monitor service availability

### 2. Data Durability
- **Backup Strategy**: Regular MongoDB backups to cloud storage
- **Cross-Region Replication**: For disaster recovery
- **Audit Logging**: Track all journal modifications

### 3. Monitoring & Observability
- **Metrics**: Prometheus for API latency, error rates, throughput
- **Logging**: Structured logging with correlation IDs
- **Distributed Tracing**: Trace requests across services
- **Alerting**: Automated alerts for service degradation

## Performance Optimizations

### 1. Caching Layer
- **Redis**: Cache frequently accessed journal summaries, user sessions
- **CDN**: Serve static assets and media through CDN

### 2. Database Optimization
- **Connection Pooling**: Efficient DB connections
- **Query Optimization**: Selective field projection
- **Pagination**: Limit large result sets

### 3. AI Pipeline Enhancements
- **Pre-processing**: Clean audio before sending to Whisper
- **Batch Transcription**: Process multiple recordings simultaneously
- **Model Warm-up**: Pre-load models into memory

## Infrastructure (Oracle Cloud Deployment)

### Current State
- **Platform**: Oracle Cloud Infrastructure (OCI)
- **Compute**: VM.Standard.A1.Flex (2 OCPUs, 12GB RAM) per instance
- **Database**: MongoDB Atlas (managed service) or OCI Managed MongoDB
- **Networking**: Public IP with port 8000 exposed

### Recommendations

#### Compute Resources
- **Scale Out**: Add multiple identical instances behind a load balancer
- **Auto-scaling**: Scale based on CPU utilization or request rate
- **GPU Instances**: Consider GPU-optimized instances for AI workloads

#### Storage
- **Object Storage**: Use OCI Standard Block Volume for media files
- **Backup**: Daily snapshots of MongoDB collections
- **Performance**: NVMe SSDs for database nodes

#### Networking
- **Security Groups**: Restrict inbound traffic to specific ports
- **Private Connectivity**: Use VPC peering for internal services
- **SSL Termination**: At load balancer level

#### CI/CD
- **Automated Testing**: Unit, integration, and e2e tests
- **Deployment Pipeline**: Blue-green deployments to minimize downtime
- **Rollback Strategy**: Quick rollback capability

## Roadmap for Improvement

### Short-term (1-2 weeks)
- [ ] Add circuit breaker pattern to API routes
- [ ] Implement retry logic with exponential backoff
- [ ] Add health check endpoints
- [ ] Set up basic monitoring (Prometheus/Grafana)

### Medium-term (1-2 months)
- [ ] Migrate to containerized deployment (Docker/Kubernetes)
- [ ] Implement Redis caching for frequent queries
- [ ] Add database sharding strategy
- [ ] Introduce async processing for AI jobs

### Long-term (3-6 months)
- [ ] Multi-region deployment for high availability
- [ ] Advanced analytics dashboard (mood trends, engagement metrics)
- [ ] Multi-language support for AI models
- [ ] Fine-grained access control (RBAC)

## Conclusion

Chronicle currently demonstrates a solid foundation for a voice journaling application. The system is modular and leverages modern technologies (React Native, FastAPI, MongoDB, external AI APIs). However, to achieve production-grade reliability and scalability, we need to:

1. **Decouple** services for horizontal scaling
2. **Cache** frequently accessed data
3. **Optimize** database queries and implement sharding
4. **Monitor** system health continuously
5. **Secure** the infrastructure with proper networking and backup strategies

The Oracle Cloud deployment provides a good starting point, but moving to a containerized, scalable architecture will significantly improve the system's resilience and performance under load.

---

*System Design Document - Chronicle*
*Generated: 2026-09-08*
