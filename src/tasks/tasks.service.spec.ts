import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  
  const repo = {
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(TasksService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when the task does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the task when it exists', async () => {
      const task = { id: '1', title: 'Write tests' };
      repo.findOneBy.mockResolvedValue(task);

      await expect(service.findOne('1')).resolves.toBe(task);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' });
    });
  });

  describe('findAll', () => {
    it('computes skip/take from page and limit and returns the meta', async () => {
      repo.findAndCount.mockResolvedValue([[], 12]);

      const result = await service.findAll({ page: 3, limit: 5 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(result.meta).toEqual({ total: 12, page: 3, limit: 5, totalPages: 3 });
    });

    it('only filters by the fields that were provided', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ status: TaskStatus.DONE, page: 1, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: TaskStatus.DONE } }),
      );
    });
  });

  describe('update', () => {
    it('merges the dto into the existing task and saves it', async () => {
      const existing = { id: '1', title: 'Old' };
      repo.findOneBy.mockResolvedValue(existing);
      repo.save.mockImplementation((t: unknown) => Promise.resolve(t));

      await service.update('1', { title: 'New' });

      expect(repo.merge).toHaveBeenCalledWith(existing, { title: 'New' });
      expect(repo.save).toHaveBeenCalledWith(existing);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('resolves when the task was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove('1')).resolves.toBeUndefined();
    });
  });
});