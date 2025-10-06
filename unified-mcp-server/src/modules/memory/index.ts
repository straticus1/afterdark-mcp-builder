import {
  CreateEntityArgsSchema,
  CreateRelationArgsSchema,
  Entity,
  Relation,
} from '../../shared/types.js';
import { Logger } from '../../shared/utils.js';

const logger = new Logger('memory');

interface MemoryStore {
  entities: Map<string, Entity>;
  relations: Set<Relation>;
}

export class MemoryModule {
  private store: MemoryStore = {
    entities: new Map(),
    relations: new Set(),
  };

  getTools() {
    return [
      {
        name: 'create_entity',
        description: 'Create a new entity in the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the entity' },
            entityType: { type: 'string', description: 'Type of the entity' },
            observations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Initial observations about the entity',
            },
          },
          required: ['name', 'entityType'],
        },
      },
      {
        name: 'create_relation',
        description: 'Create a new relation between entities',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source entity name' },
            to: { type: 'string', description: 'Target entity name' },
            relationType: { type: 'string', description: 'Type of relation' },
          },
          required: ['from', 'to', 'relationType'],
        },
      },
      {
        name: 'add_observation',
        description: 'Add an observation to an existing entity',
        inputSchema: {
          type: 'object',
          properties: {
            entityName: { type: 'string', description: 'Name of the entity' },
            observation: { type: 'string', description: 'Observation to add' },
          },
          required: ['entityName', 'observation'],
        },
      },
      {
        name: 'delete_entity',
        description: 'Delete an entity and all its relations',
        inputSchema: {
          type: 'object',
          properties: {
            entityName: { type: 'string', description: 'Name of the entity to delete' },
          },
          required: ['entityName'],
        },
      },
      {
        name: 'delete_relation',
        description: 'Delete a specific relation',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source entity name' },
            to: { type: 'string', description: 'Target entity name' },
            relationType: { type: 'string', description: 'Type of relation' },
          },
          required: ['from', 'to', 'relationType'],
        },
      },
      {
        name: 'list_entities',
        description: 'List all entities in the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            entityType: { type: 'string', description: 'Filter by entity type (optional)' },
          },
        },
      },
      {
        name: 'list_relations',
        description: 'List all relations in the knowledge graph',
        inputSchema: {
          type: 'object',
          properties: {
            entityName: { type: 'string', description: 'Filter by entity name (optional)' },
          },
        },
      },
      {
        name: 'search_entities',
        description: 'Search entities by observation content',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_entity',
        description: 'Get detailed information about a specific entity',
        inputSchema: {
          type: 'object',
          properties: {
            entityName: { type: 'string', description: 'Name of the entity' },
          },
          required: ['entityName'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling memory tool: ${name}`, args);

    try {
      switch (name) {
        case 'create_entity':
          return await this.createEntity(CreateEntityArgsSchema.parse(args));
        case 'create_relation':
          return await this.createRelation(CreateRelationArgsSchema.parse(args));
        case 'add_observation':
          return await this.addObservation(args.entityName, args.observation);
        case 'delete_entity':
          return await this.deleteEntity(args.entityName);
        case 'delete_relation':
          return await this.deleteRelation(args.from, args.to, args.relationType);
        case 'list_entities':
          return await this.listEntities(args.entityType);
        case 'list_relations':
          return await this.listRelations(args.entityName);
        case 'search_entities':
          return await this.searchEntities(args.query);
        case 'get_entity':
          return await this.getEntity(args.entityName);
        default:
          throw new Error(`Unknown memory tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in memory tool ${name}:`, error);
      throw error;
    }
  }

  private async createEntity(args: {
    name: string;
    entityType: string;
    observations?: string[];
  }): Promise<{ success: boolean; entity: Entity }> {
    if (this.store.entities.has(args.name)) {
      throw new Error(`Entity with name '${args.name}' already exists`);
    }

    const entity: Entity = {
      name: args.name,
      entityType: args.entityType,
      observations: args.observations || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.entities.set(args.name, entity);
    logger.info(`Created entity: ${args.name} (${args.entityType})`);

    return { success: true, entity };
  }

  private async createRelation(args: {
    from: string;
    to: string;
    relationType: string;
  }): Promise<{ success: boolean; relation: Relation }> {
    // Check if both entities exist
    if (!this.store.entities.has(args.from)) {
      throw new Error(`Source entity '${args.from}' does not exist`);
    }
    if (!this.store.entities.has(args.to)) {
      throw new Error(`Target entity '${args.to}' does not exist`);
    }

    const relation: Relation = {
      from: args.from,
      to: args.to,
      relationType: args.relationType,
      createdAt: new Date().toISOString(),
    };

    // Check if relation already exists
    const existingRelation = Array.from(this.store.relations).find(
      r => r.from === args.from && r.to === args.to && r.relationType === args.relationType
    );

    if (existingRelation) {
      throw new Error(`Relation already exists: ${args.from} -[${args.relationType}]-> ${args.to}`);
    }

    this.store.relations.add(relation);
    logger.info(`Created relation: ${args.from} -[${args.relationType}]-> ${args.to}`);

    return { success: true, relation };
  }

  private async addObservation(entityName: string, observation: string): Promise<{ success: boolean }> {
    const entity = this.store.entities.get(entityName);
    if (!entity) {
      throw new Error(`Entity '${entityName}' does not exist`);
    }

    entity.observations.push(observation);
    entity.updatedAt = new Date().toISOString();

    logger.info(`Added observation to entity: ${entityName}`);
    return { success: true };
  }

  private async deleteEntity(entityName: string): Promise<{ success: boolean }> {
    if (!this.store.entities.has(entityName)) {
      throw new Error(`Entity '${entityName}' does not exist`);
    }

    // Remove all relations involving this entity
    this.store.relations = new Set(
      Array.from(this.store.relations).filter(
        r => r.from !== entityName && r.to !== entityName
      )
    );

    // Remove the entity
    this.store.entities.delete(entityName);
    logger.info(`Deleted entity and related relations: ${entityName}`);

    return { success: true };
  }

  private async deleteRelation(from: string, to: string, relationType: string): Promise<{ success: boolean }> {
    const relationToDelete = Array.from(this.store.relations).find(
      r => r.from === from && r.to === to && r.relationType === relationType
    );

    if (!relationToDelete) {
      throw new Error(`Relation not found: ${from} -[${relationType}]-> ${to}`);
    }

    this.store.relations.delete(relationToDelete);
    logger.info(`Deleted relation: ${from} -[${relationType}]-> ${to}`);

    return { success: true };
  }

  private async listEntities(entityType?: string): Promise<{ entities: Entity[] }> {
    let entities = Array.from(this.store.entities.values());

    if (entityType) {
      entities = entities.filter(e => e.entityType === entityType);
    }

    return { entities };
  }

  private async listRelations(entityName?: string): Promise<{ relations: Relation[] }> {
    let relations = Array.from(this.store.relations);

    if (entityName) {
      relations = relations.filter(r => r.from === entityName || r.to === entityName);
    }

    return { relations };
  }

  private async searchEntities(query: string): Promise<{ entities: Entity[] }> {
    const lowercaseQuery = query.toLowerCase();
    const matchingEntities = Array.from(this.store.entities.values()).filter(entity => {
      const nameMatch = entity.name.toLowerCase().includes(lowercaseQuery);
      const typeMatch = entity.entityType.toLowerCase().includes(lowercaseQuery);
      const observationMatch = entity.observations.some(obs =>
        obs.toLowerCase().includes(lowercaseQuery)
      );

      return nameMatch || typeMatch || observationMatch;
    });

    return { entities: matchingEntities };
  }

  private async getEntity(entityName: string): Promise<{ entity: Entity; relations: Relation[] }> {
    const entity = this.store.entities.get(entityName);
    if (!entity) {
      throw new Error(`Entity '${entityName}' does not exist`);
    }

    const relations = Array.from(this.store.relations).filter(
      r => r.from === entityName || r.to === entityName
    );

    return { entity, relations };
  }

  // Utility methods for data persistence (could be extended to save to file/database)
  exportData(): { entities: Entity[]; relations: Relation[] } {
    return {
      entities: Array.from(this.store.entities.values()),
      relations: Array.from(this.store.relations),
    };
  }

  importData(data: { entities: Entity[]; relations: Relation[] }): void {
    this.store.entities.clear();
    this.store.relations.clear();

    data.entities.forEach(entity => {
      this.store.entities.set(entity.name, entity);
    });

    data.relations.forEach(relation => {
      this.store.relations.add(relation);
    });

    logger.info(`Imported ${data.entities.length} entities and ${data.relations.length} relations`);
  }
}