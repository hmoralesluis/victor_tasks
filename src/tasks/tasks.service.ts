import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
import { QueryTasksDto } from './dto/query-tasks.dto';

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly repo: Repository<Task>) {}

  create(createTaskDto: CreateTaskDto): Promise<Task> {
    const task = this.repo.create(createTaskDto);
    return this.repo.save(task);
  }

  async findAll({ status, assignee, page, limit }: QueryTasksDto) {

    const where: FindOptionsWhere<Task> = {};
    if (status) where.status = status;
    if (assignee) where.assignee = assignee;

    const [data, total] = await this.repo.findAndCount({
        where,
        order: {createdAt: 'DESC', id: 'ASC'},
        skip: (page - 1 ) * limit,
        take: limit
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

  }

  async findOne(id: string): Promise<Task> {
    const task = await this.repo.findOneBy({id});
    if (!task) throw new NotFoundException(`The task with id ${id} not found`);
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    this.repo.merge(task, updateTaskDto);
    return this.repo.save(task);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (result.affected === 0) throw new NotFoundException(`The Task with id ${id} not found`);
  }

}
