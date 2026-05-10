// Reusable OpenAPI components (schemas, security)
module.exports = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    }
  },
  schemas: {
    Pagination: {
      type: 'object',
      properties: {
        total_results: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total_pages: { type: 'integer' }
      }
    },
    LocationPoint: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' }
      },
      required: ['lat', 'lng']
    },
    UserLocationRecord: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' },
        accuracy: { type: 'number' },
        source: { type: 'string' },
        recordedAt: { type: 'string', format: 'date-time' }
      }
    },
    POI: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        google_place_id: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['atm', 'gasstation'] },
        location: { $ref: '#/components/schemas/LocationPoint' },
        address: { type: 'string' },
        distance_km: { type: 'number' },
        google_data: { type: 'object' },
        last_sync_at: { type: 'string', format: 'date-time' }
      }
    },
    POIUpdate: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        poi_id: { type: 'integer' },
        poi: { $ref: '#/components/schemas/POI' },
        type: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        status: { type: 'string' },
        contributor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            profile_picture: { type: 'string' }
          }
        },
        validations: {
          type: 'object',
          properties: {
            valid: { type: 'integer' },
            reports: { type: 'integer' }
          }
        }
      }
    },
    Payment: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        userId: { type: 'integer' },
        reference: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        description: { type: 'string' },
        method: { type: 'string', enum: ['card', 'bank', 'crypto', 'wallet'] },
        status: { type: 'string', enum: ['pending', 'successful', 'failed'] },
        provider: { type: 'string' },
        type: { type: 'string' },
        paymentUrl: { type: 'string' },
        metadata: { type: 'object' },
        verifiedAt: { type: 'string', format: 'date-time' }
      }
    }
  }
};
